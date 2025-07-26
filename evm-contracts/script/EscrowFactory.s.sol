// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {EscrowFactory} from "../src/EscrowFactory.sol";

contract EscrowFactoryScript is Script {
    EscrowFactory public escrowFactory;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        escrowFactory = new EscrowFactory();

        vm.stopBroadcast();
    }
}
