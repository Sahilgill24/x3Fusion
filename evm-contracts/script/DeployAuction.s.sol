// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Script.sol";
import "../src/DutchAuction.sol";

contract DeployDutchAuctionCalculator is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy the DutchAuction
        DutchAuction auction = new DutchAuction();

        console.log("DutchAuction deployed at:", address(auction));

        vm.stopBroadcast();
    }
}
