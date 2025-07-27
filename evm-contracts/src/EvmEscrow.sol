// SPDX-License-Identifier: MIT

pragma solidity 0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AddressLib, Address} from "../lib/AddressLib.sol";
import {Timelocks, TimelocksLib} from "../lib/TimelocksLib.sol";

import {IBaseEscrow} from "../interfaces/IBaseEscrow.sol";
import {BaseEscrow} from "./BaseEscrow.sol";
import {Escrow} from "./Escrow.sol";

contract EvmEscrow is Escrow {
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
     * @notice Withdraws funds to the taker with the correct secret
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
        onlyAfter(immutables.timelocks.get(TimelocksLib.Stage.SrcWithdrawal))
        onlyBefore(immutables.timelocks.get(TimelocksLib.Stage.SrcCancellation))
    {
        // Check if caller is authorized
        bool isPublicPeriod = block.timestamp >=
            immutables.timelocks.get(TimelocksLib.Stage.SrcPublicWithdrawal);
        if (!isPublicPeriod) {
            // Private period - only taker can withdraw
            if (msg.sender != immutables.taker.get()) revert InvalidCaller();
        }
        // In public period, anyone can withdraw with correct secret

        address token = immutables.token.get();
        address taker = immutables.taker.get();

        // Transfer main amount to taker
        _uniTransfer(token, taker, immutables.amount);

        // Transfer safety deposit to caller (reward for withdrawal)
        if (immutables.safetyDeposit > 0) {
            _uniTransfer(token, msg.sender, immutables.safetyDeposit);
        }

        emit EscrowWithdrawal(secret);
    }

    /**
     * @notice Cancels the escrow and returns funds to maker
     * @dev Can only be called by taker during cancellation period
     * @param immutables The immutables of the escrow contract
     */
    function cancel(
        Immutables calldata immutables
    )
        external
        override
        onlyTaker(immutables)
        onlyValidImmutables(immutables)
        onlyAfter(immutables.timelocks.get(TimelocksLib.Stage.SrcCancellation))
    {
        address token = immutables.token.get();
        address maker = immutables.maker.get();
        address taker = immutables.taker.get();

        // Return main amount to maker
        _uniTransfer(token, maker, immutables.amount);

        // Return safety deposit to taker
        if (immutables.safetyDeposit > 0) {
            _uniTransfer(token, taker, immutables.safetyDeposit);
        }

        emit EscrowCancelled();
    }
}
