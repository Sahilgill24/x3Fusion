// SPDX-License-Identifier: MIT

pragma solidity 0.8.23;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {EvmEscrowFactory} from "../src/EvmEscrowFactory.sol";
import {IBaseEscrow} from "../interfaces/IBaseEscrow.sol";
import {AddressLib, Address} from "../lib/AddressLib.sol";
import {TimelocksLib, Timelocks} from "../lib/TimelocksLib.sol";

/**
 * @title Deploy EvmEscrowFactory Script
 * @notice Script to deploy the EvmEscrowFactory contract
 */
contract DeployEvmEscrowFactory is Script {
    using AddressLib for Address;
    using TimelocksLib for Timelocks;

    function run() external {
        bytes32 privateKeyBytes = vm.envBytes32("PRIVATE_KEY");
        uint256 deployerPrivateKey = uint256(privateKeyBytes);
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast();

        // Configuration parameters
        address accessToken = vm.envOr("ACCESS_TOKEN", address(0)); // Set to address(0) for no access token requirement
        address owner = vm.envOr("OWNER", deployer); // Default to deployer
        uint32 rescueDelay = uint32(vm.envOr("RESCUE_DELAY", uint256(86400))); // 24 hours default
        uint256 creationFee = vm.envOr("CREATION_FEE", uint256(0.001 ether)); // 0.001 ETH default
        address treasury = vm.envOr("TREASURY", deployer); // Default to deployer

        // Deploy the factory
        EvmEscrowFactory factory = new EvmEscrowFactory(
            IERC20(accessToken),
            owner,
            rescueDelay,
            creationFee,
            treasury
        );

        console.log("EvmEscrowFactory deployed at:", address(factory));

        vm.stopBroadcast();
    }
}
