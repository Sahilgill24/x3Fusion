// SPDX-License-Identifier: MIT
// Contract Address: 0xC3deF82aD7C16299b60C792B3c92D29DDB4e9485 (Calculator)
// Block: 8900805
// Paid: 0.000000380505844316 ETH (209966 gas * 0.001812226 gwei)

// ##### sepolia
// ✅  [Success]Hash: 0x4e886122fb00695c94a61ac4fe2ef6b960f0a31b0289c1492e22a4c2615b7126
// Contract Address: 0x4B4c97f5B98e22160d4D5582865a218308a084bA (order Filler)
// Block: 8900806
// Paid: 0.000000693604539742 ETH (382414 gas * 0.001813753 gwei)
pragma solidity 0.8.23;

import "forge-std/Script.sol";
import "../src/OrderFiller.sol";
import "../src/DutchAuctionCalculator.sol";

contract DeployDutchAuctionCalculator is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy the DutchAuctionCalculator first
        DutchAuctionCalculator calculator = new DutchAuctionCalculator();
        console.log("DutchAuctionCalculator deployed at:", address(calculator));

        // Deploy the DutchAuctionFiller (OrderFiller) with the calculator address
        DutchAuctionFiller orderFiller = new DutchAuctionFiller(calculator);
        console.log("DutchAuctionFiller deployed at:", address(orderFiller));

        vm.stopBroadcast();
    }
}
