// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./DutchAuctionCalculator.sol";

/// @title Fills EVM-side portion of cross-chain Dutch-auction orders
contract DutchAuctionFiller {
    DutchAuctionCalculator public immutable calculator;

    /// @notice Track filled amounts for each order
    mapping(bytes32 => uint256) public filledAmounts;

    event PartialFill(
        bytes32 indexed orderHash,
        address indexed filler,
        uint256 fillAmount,
        uint256 totalFilled
    );

    constructor(DutchAuctionCalculator _calculator) {
        calculator = _calculator;
    }

    /// @notice Fill an order partially or completely
    function fillOrder(
        DutchAuctionCalculator.Order calldata order,
        bytes calldata extraData,
        uint256 requestedAmount
    ) external returns (bytes32) {
        bytes32 orderHash = keccak256(abi.encode(order));

        // Update order with current fill state
        DutchAuctionCalculator.Order memory currentOrder = order;
        currentOrder.filledAmount = filledAmounts[orderHash];

        // Calculate actual fill amount
        uint256 fillAmount = calculator.getMakingAmount(
            currentOrder,
            requestedAmount,
            extraData
        );

        require(fillAmount > 0, "Nothing to fill");

        // Update filled amount
        filledAmounts[orderHash] += fillAmount;

        emit PartialFill(
            orderHash,
            msg.sender,
            fillAmount,
            filledAmounts[orderHash]
        );

        return orderHash;
    }

    /// @notice Get remaining fillable amount
    function getRemainingAmount(
        DutchAuctionCalculator.Order calldata order
    ) external view returns (uint256) {
        bytes32 orderHash = keccak256(abi.encode(order));
        return order.makingAmount - filledAmounts[orderHash];
    }
}
