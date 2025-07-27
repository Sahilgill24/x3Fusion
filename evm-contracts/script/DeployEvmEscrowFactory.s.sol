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
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying EvmEscrowFactory with deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Configuration parameters
        address accessToken = vm.envOr("ACCESS_TOKEN", address(0)); // Set to address(0) for no access token requirement
        address owner = vm.envOr("OWNER", deployer); // Default to deployer
        uint32 rescueDelay = uint32(vm.envOr("RESCUE_DELAY", uint256(86400))); // 24 hours default
        uint256 creationFee = vm.envOr("CREATION_FEE", uint256(0.001 ether)); // 0.001 ETH default
        address treasury = vm.envOr("TREASURY", deployer); // Default to deployer

        console.log("Access Token:", accessToken);
        console.log("Owner:", owner);
        console.log("Rescue Delay:", rescueDelay);
        console.log("Creation Fee:", creationFee);
        console.log("Treasury:", treasury);

        // Deploy the factory
        EvmEscrowFactory factory = new EvmEscrowFactory(
            IERC20(accessToken),
            owner,
            rescueDelay,
            creationFee,
            treasury
        );

        console.log("EvmEscrowFactory deployed at:", address(factory));
        console.log("Implementation deployed at:", factory.getImplementation());
        console.log(
            "Proxy bytecode hash:",
            vm.toString(factory.getProxyBytecodeHash())
        );

        vm.stopBroadcast();

        // Log deployment info
        console.log("\n=== Deployment Summary ===");
        console.log("Factory Address:", address(factory));
        console.log("Implementation Address:", factory.getImplementation());
        console.log("Access Token:", accessToken);
        console.log("Owner:", owner);
        console.log("Rescue Delay:", rescueDelay, "seconds");
        console.log("Creation Fee:", creationFee, "wei");
        console.log("Treasury:", treasury);
    }

    /**
     * @notice Example function to create a test escrow after deployment
     * @dev This would be called separately after the factory is deployed
     */
    function createTestEscrow() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Get the deployed factory address (you'd need to set this)
        address factoryAddress = vm.envAddress("FACTORY_ADDRESS");
        EvmEscrowFactory factory = EvmEscrowFactory(payable(factoryAddress));

        vm.startBroadcast(deployerPrivateKey);

        // Example escrow parameters
        IBaseEscrow.Immutables memory immutables = IBaseEscrow.Immutables({
            orderHash: keccak256("test_order_123"),
            hashlock: keccak256(abi.encodePacked("secret123")), // Hash of "secret123"
            maker: Address.wrap(uint160(deployer)),
            taker: Address.wrap(uint160(deployer)), // Using same address for testing
            token: Address.wrap(0), // ETH
            amount: 1 ether,
            safetyDeposit: 0.1 ether,
            timelocks: createTestTimelocks()
        });

        // Calculate required payment
        uint256 requiredEth = immutables.amount +
            immutables.safetyDeposit +
            factory.creationFee();

        console.log("Creating test escrow with", requiredEth, "ETH");

        // Create the escrow
        factory.createEscrow{value: requiredEth}(immutables);

        console.log("Test escrow created successfully");

        vm.stopBroadcast();
    }

    /**
     * @notice Creates test timelocks for demo purposes
     */
    function createTestTimelocks() internal view returns (Timelocks) {
        uint256 currentTime = block.timestamp;

        // Create timelocks with:
        // - Withdrawal starts immediately
        // - Public withdrawal starts after 1 hour
        // - Cancellation starts after 24 hours
        Timelocks timelocks = Timelocks.wrap(0);
        timelocks = timelocks.setDeployedAt(currentTime);

        // Note: The actual TimelocksLib functions would need to be called here
        // This is a simplified example
        return timelocks;
    }
}
