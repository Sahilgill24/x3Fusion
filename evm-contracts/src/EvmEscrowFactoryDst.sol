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
import {EvmEscrowDst} from "./EvmEscrowDst.sol";

/**
 * @title EvmEscrowDst Factory contract for cross-chain atomic swaps
 * @notice Factory contract to deploy EvmEscrowDst contracts with deterministic addresses
 * @dev Uses Create2 for deterministic deployment and handles token transfers
 */
contract EvmEscrowFactoryDst is Ownable {
    using SafeERC20 for IERC20;
    using AddressLib for Address;
    using TimelocksLib for Timelocks;
    using ImmutablesLib for IBaseEscrow.Immutables;

    /// @notice Implementation contract for escrows
    EvmEscrowDst public immutable ESCROW_IMPLEMENTATION;

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
        address indexed maker,
        address taker,
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
        ESCROW_IMPLEMENTATION = new EvmEscrowDst(rescueDelay, accessToken);

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
        bytes32 salt = ImmutablesLib.hashMem(deployImmutables);

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
            immutables.maker.get(),
            immutables.taker.get(),
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
        bytes32 salt = ImmutablesLib.hashMem(immutables);

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
        uint256 totalFees = 0;

        for (uint256 i = 0; i < immutablesArray.length; i++) {
            IBaseEscrow.Immutables calldata immutables = immutablesArray[i];
            address token = immutables.token.get();

            // Calculate required ETH for this escrow
            uint256 requiredForEscrow = token == address(0)
                ? immutables.amount + immutables.safetyDeposit
                : immutables.safetyDeposit;

            totalFees += requiredForEscrow;
        }

        // Add creation fees
        totalFees += creationFee * immutablesArray.length;

        // Verify sufficient ETH sent
        if (msg.value != totalFees) {
            revert InsufficientEscrowBalance();
        }

        // Process each escrow
        uint256 ethUsed = 0;
        for (uint256 i = 0; i < immutablesArray.length; i++) {
            IBaseEscrow.Immutables calldata immutables = immutablesArray[i];
            address token = immutables.token.get();

            // Calculate required ETH for this escrow
            uint256 requiredForEscrow = token == address(0)
                ? immutables.amount + immutables.safetyDeposit
                : immutables.safetyDeposit;

            // Set deployment timestamp
            IBaseEscrow.Immutables memory deployImmutables = immutables;
            deployImmutables.timelocks = immutables.timelocks.setDeployedAt(
                block.timestamp
            );

            // Compute salt
            bytes32 salt = ImmutablesLib.hashMem(deployImmutables);

            // Create proxy bytecode
            bytes memory bytecode = abi.encodePacked(
                hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
                address(ESCROW_IMPLEMENTATION),
                hex"5af43d82803e903d91602b57fd5bf3"
            );

            // Deploy escrow
            address escrow;
            assembly {
                escrow := create2(
                    requiredForEscrow,
                    add(bytecode, 0x20),
                    mload(bytecode),
                    salt
                )
            }

            if (escrow == address(0)) {
                revert EscrowDeploymentFailed();
            }

            // Mark as deployed escrow
            isEscrow[escrow] = true;

            // For ERC20 token swaps, transfer tokens to escrow
            if (token != address(0)) {
                IERC20(token).safeTransferFrom(
                    msg.sender,
                    escrow,
                    immutables.amount
                );
            }

            // Track ETH used
            ethUsed += requiredForEscrow;

            emit EscrowCreated(
                escrow,
                immutables.hashlock,
                immutables.maker.get(),
                immutables.taker.get(),
                token,
                immutables.amount,
                immutables.safetyDeposit
            );
        }

        // Transfer all creation fees to treasury
        if (creationFee > 0 && treasury != address(0)) {
            uint256 totalCreationFees = creationFee * immutablesArray.length;
            (bool success, ) = treasury.call{value: totalCreationFees}("");
            if (!success) revert FeeTransferFailed();
        }
    }

    /**
     * @notice Update the creation fee
     * @param newFee The new fee amount in wei
     */
    function setCreationFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = creationFee;
        creationFee = newFee;
        emit CreationFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Update the treasury address
     * @param newTreasury The new treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }
}
