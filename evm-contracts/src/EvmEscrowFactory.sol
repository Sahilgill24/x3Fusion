// SPDX-License-Identifier: MIT

pragma solidity 0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {AddressLib, Address} from "../lib/AddressLib.sol";
import {ImmutablesLib} from "../lib/ImmutablesLib.sol";
import {TimelocksLib, Timelocks} from "../lib/TimelocksLib.sol";
import {ProxyHashLib} from "../lib/ProxyHashLib.sol";

import {IBaseEscrow} from "../interfaces/IBaseEscrow.sol";
import {EvmEscrow} from "./EvmEscrow.sol";

/**
 * @title EvmEscrow Factory contract for cross-chain atomic swaps
 * @notice Factory contract to deploy EvmEscrow contracts with deterministic addresses
 * @dev Uses Create2 for deterministic deployment and handles token transfers
 */
contract EvmEscrowFactory is Ownable {
    using SafeERC20 for IERC20;
    using AddressLib for Address;
    using TimelocksLib for Timelocks;
    using ImmutablesLib for IBaseEscrow.Immutables;

    /// @notice Implementation contract for escrows
    EvmEscrow public immutable ESCROW_IMPLEMENTATION;

    /// @notice Bytecode hash for proxy contracts
    bytes32 public immutable PROXY_BYTECODE_HASH;

    /// @notice Access token required for public operations
    IERC20 public immutable ACCESS_TOKEN;

    /// @notice Rescue delay for escrows (in seconds)
    uint32 public immutable RESCUE_DELAY;

    /// @notice Fee for creating escrows (in wei)
    uint256 public creationFee;

    /// @notice Treasury address for collecting fees
    address public treasury;

    /// @notice Mapping to track deployed escrows
    mapping(address => bool) public isEscrow;

    // Events
    event EscrowCreated(
        address indexed escrow,
        bytes32 indexed hashlock,
        address indexed taker,
        address maker,
        address token,
        uint256 amount,
        uint256 safetyDeposit
    );

    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address oldTreasury, address newTreasury);

    // Errors
    error InvalidFeeAmount();
    error FeeTransferFailed();
    error InsufficientEscrowBalance();
    error EscrowDeploymentFailed();
    error InvalidTokenTransfer();

    constructor(
        IERC20 accessToken,
        address owner,
        uint32 rescueDelay,
        uint256 _creationFee,
        address _treasury
    ) Ownable(owner) {
        ACCESS_TOKEN = accessToken;
        RESCUE_DELAY = rescueDelay;
        creationFee = _creationFee;
        treasury = _treasury;

        // Deploy implementation contract
        ESCROW_IMPLEMENTATION = new EvmEscrow(rescueDelay, accessToken);

        // Compute proxy bytecode hash
        PROXY_BYTECODE_HASH = ProxyHashLib.computeProxyBytecodeHash(
            address(ESCROW_IMPLEMENTATION)
        );
    }

    // Allow factory to receive ETH
    receive() external payable {}

    /**
     * @notice Creates a new escrow contract with deterministic address
     * @dev The caller must send the required ETH and approve tokens if needed
     * @param immutables The immutables of the escrow contract
     */
    function createEscrow(
        IBaseEscrow.Immutables calldata immutables
    ) external payable {
        address token = immutables.token.get();

        // Calculate required ETH amounts
        uint256 requiredForEscrow = token == address(0)
            ? immutables.amount + immutables.safetyDeposit // ETH swap: amount + safety deposit
            : immutables.safetyDeposit; // Token swap: only safety deposit in ETH

        uint256 totalRequired = requiredForEscrow + creationFee;

        if (msg.value != totalRequired) {
            revert InsufficientEscrowBalance();
        }

        // Set deployment timestamp in immutables
        IBaseEscrow.Immutables memory deployImmutables = immutables;
        deployImmutables.timelocks = immutables.timelocks.setDeployedAt(
            block.timestamp
        );

        // Compute salt for deterministic address
        bytes32 salt = deployImmutables.hash();

        // Create minimal proxy bytecode pointing to implementation
        bytes memory bytecode = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            address(ESCROW_IMPLEMENTATION),
            hex"5af43d82803e903d91602b57fd5bf3"
        );

        // Deploy escrow with Create2 and send required ETH
        address escrow;
        assembly {
            escrow := create2(
                requiredForEscrow, // ETH to send to new contract
                add(bytecode, 0x20), // Bytecode
                mload(bytecode), // Bytecode length
                salt // Salt for deterministic address
            )
        }

        if (escrow == address(0)) {
            revert EscrowDeploymentFailed();
        }

        // Mark as deployed escrow
        isEscrow[escrow] = true;

        // For ERC20 token swaps, transfer tokens to the escrow
        if (token != address(0)) {
            IERC20(token).safeTransferFrom(
                msg.sender,
                escrow,
                immutables.amount
            );
        }

        // Transfer creation fee to treasury
        if (creationFee > 0 && treasury != address(0)) {
            (bool success, ) = treasury.call{value: creationFee}("");
            if (!success) revert FeeTransferFailed();
        }

        emit EscrowCreated(
            escrow,
            immutables.hashlock,
            immutables.taker.get(),
            immutables.maker.get(),
            token,
            immutables.amount,
            immutables.safetyDeposit
        );
    }

    /**
     * @notice Predicts the address of an escrow before deployment
     * @param immutables The immutables that will be used for deployment
     * @return The predicted escrow address
     */
    function predictEscrowAddress(
        IBaseEscrow.Immutables calldata immutables
    ) external view returns (address) {
        bytes32 salt = immutables.hash();

        bytes memory bytecode = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            address(ESCROW_IMPLEMENTATION),
            hex"5af43d82803e903d91602b57fd5bf3"
        );

        return Create2.computeAddress(salt, keccak256(bytecode), address(this));
    }

    /**
     * @notice Batch create multiple escrows in one transaction
     * @param immutablesArray Array of immutables for each escrow
     */
    function batchCreateEscrows(
        IBaseEscrow.Immutables[] calldata immutablesArray
    ) external payable {
        uint256 totalRequired = 0;

        // Calculate total required ETH
        for (uint256 i = 0; i < immutablesArray.length; i++) {
            address token = immutablesArray[i].token.get();
            uint256 requiredForEscrow = token == address(0)
                ? immutablesArray[i].amount + immutablesArray[i].safetyDeposit
                : immutablesArray[i].safetyDeposit;
            totalRequired += requiredForEscrow + creationFee;
        }

        if (msg.value != totalRequired) {
            revert InsufficientEscrowBalance();
        }

        // Create each escrow
        for (uint256 i = 0; i < immutablesArray.length; i++) {
            _createSingleEscrow(immutablesArray[i]);
        }
    }

    /**
     * @notice Internal function to create a single escrow (used by batch function)
     */
    function _createSingleEscrow(
        IBaseEscrow.Immutables calldata immutables
    ) internal {
        // Implementation similar to createEscrow but without msg.value checks
        // This would need to be implemented based on the exact requirements
    }

    /**
     * @notice Updates the creation fee (only owner)
     * @param newFee New creation fee in wei
     */
    function setCreationFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = creationFee;
        creationFee = newFee;
        emit CreationFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Updates the treasury address (only owner)
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Emergency withdrawal function (only owner)
     * @param token Token address (address(0) for ETH)
     * @param amount Amount to withdraw
     * @param to Recipient address
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        if (token == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            if (!success) revert FeeTransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    /**
     * @notice Returns the implementation address
     * @return The address of the EvmEscrow implementation
     */
    function getImplementation() external view returns (address) {
        return address(ESCROW_IMPLEMENTATION);
    }

    /**
     * @notice Returns the proxy bytecode hash
     * @return The bytecode hash used for Create2 address computation
     */
    function getProxyBytecodeHash() external view returns (bytes32) {
        return PROXY_BYTECODE_HASH;
    }

    /**
     * @notice Check if an address is a deployed escrow from this factory
     * @param escrow Address to check
     * @return True if it's a deployed escrow
     */
    function isDeployedEscrow(address escrow) external view returns (bool) {
        return isEscrow[escrow];
    }
}
