// SPDX-License-Identifier: MIT

pragma solidity 0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AddressLib, Address} from "../lib/AddressLib.sol";
import {Timelocks, TimelocksLib} from "../lib/TimelocksLib.sol";

import {IBaseEscrow} from "../interfaces/IBaseEscrow.sol";
import {BaseEscrow} from "./BaseEscrow.sol";
import {Escrow} from "./Escrow.sol";

/**
 * @title Destination EvmEscrow contract for cross-chain atomic swaps
 * @notice Handles the receiving side of cross-chain atomic swaps
 * @dev Reverses the flow of funds compared to the source version
 */
contract EvmEscrowDst is Escrow {
    using AddressLib for Address;
    using SafeERC20 for IERC20;
    using TimelocksLib for Timelocks;

    /// @notice Constructor sets rescue delay and access token
    constructor(
        uint32 rescueDelay,
        IERC20 accessToken
    ) BaseEscrow(rescueDelay, accessToken) {}

    // Allow contract to receive ETH
    receive() external payable {}

    /**
     * @notice Withdraws funds to the maker with the correct secret
     * @dev Can only be called during withdrawal period with valid secret
     * @param secret The secret that unlocks the escrow
     * @param immutables The immutables of the escrow contract
     */
    function withdraw(
        bytes32 secret,
        Immutables calldata immutables
    )
        external
        override
        onlyValidImmutables(immutables)
        onlyValidSecret(secret, immutables)
        onlyAfter(immutables.timelocks.get(TimelocksLib.Stage.Withdrawal))
        onlyBefore(immutables.timelocks.get(TimelocksLib.Stage.Cancellation))
    {
        // Check if caller is authorized
        bool isPublicPeriod = block.timestamp >=
            immutables.timelocks.get(TimelocksLib.Stage.PublicWithdrawal);
        if (!isPublicPeriod) {
            // Private period - only maker can withdraw
            if (msg.sender != immutables.maker.get()) revert InvalidCaller();
        }
        // In public period, anyone can withdraw with correct secret

        _withdraw(secret, immutables);

        emit EscrowWithdrawal(secret);
    }

    /**
     * @notice Cancels the escrow and returns funds to taker
     * @dev Can only be called by maker during cancellation period
     * @param immutables The immutables of the escrow contract
     */
    function cancel(
        Immutables calldata immutables
    )
        external
        override
        onlyMaker(immutables)
        onlyValidImmutables(immutables)
        onlyAfter(immutables.timelocks.get(TimelocksLib.Stage.Cancellation))
    {
        address token = immutables.token.get();
        address maker = immutables.maker.get();
        address taker = immutables.taker.get();

        // Return main amount to taker
        _uniTransfer(token, taker, immutables.amount);

        // Return safety deposit to maker
        if (immutables.safetyDeposit > 0) {
            _uniTransfer(token, maker, immutables.safetyDeposit);
        }

        emit EscrowCancelled();
    }

    /**
     * @dev Transfers tokens to the target
     * @param secret The secret that unlocks the escrow
     * @param immutables The immutable values used to deploy the clone contract
     */
    function _withdraw(
        bytes32 secret,
        Immutables calldata immutables
    )
        internal
        onlyValidImmutables(immutables)
        onlyValidSecret(secret, immutables)
    {
        address token = immutables.token.get();
        address maker = immutables.maker.get();

        // Transfer main amount to maker
        _uniTransfer(token, maker, immutables.amount);

        // Transfer safety deposit to caller/taker
        if (immutables.safetyDeposit > 0) {
            _uniTransfer(token, msg.sender, immutables.safetyDeposit);
        }
    }
}
