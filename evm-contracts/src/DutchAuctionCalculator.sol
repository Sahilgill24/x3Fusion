// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/utils/math/Math.sol";

/// @title Computes Dutch-auction price decay
/// @notice Linear interpolation between start/end prices over a time window
contract DutchAuctionCalculator {
    using Math for uint256;

    uint256 private constant _LOW_128_BITS = 0xffffffffffffffffffffffffffffffff;

    struct Order {
        uint256 salt;
        address maker;
        address receiver;
        address makerAsset;
        uint256 makingAmount;
        uint256 filledAmount;
    }

    /// @notice Given desired off-chain asset amount, compute required makerAsset amount
    function getMakingAmount(
        Order calldata order,
        uint256 offchainAmount,
        bytes calldata extraData
    ) external view returns (uint256) {
        (uint256 times, uint256 startPrice, uint256 endPrice) = abi.decode(
            extraData,
            (uint256, uint256, uint256)
        );
        uint256 price = _calcPrice(times, startPrice, endPrice);

        // Calculate available amount (unfilled portion)
        uint256 availableAmount = order.makingAmount - order.filledAmount;
        uint256 requestedAmount = (availableAmount * offchainAmount) / price;

        // Return minimum of requested and available
        return
            requestedAmount > availableAmount
                ? availableAmount
                : requestedAmount;
    }

    function _calcPrice(
        uint256 times,
        uint256 startPrice,
        uint256 endPrice
    ) private view returns (uint256) {
        uint256 startTime = times >> 128;
        uint256 endTime = times & _LOW_128_BITS;
        uint256 nowClamped = Math.max(
            startTime,
            Math.min(endTime, block.timestamp)
        );
        uint256 span = endTime - startTime;
        return
            (startPrice *
                (endTime - nowClamped) +
                endPrice *
                (nowClamped - startTime)) / span;
    }
}
