// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/OPickAttentionFactory.sol";
import "../src/OPickAttentionMarket.sol";

/// @title Deploy - Base mainnet deployment script for OPick V6 Attention Markets
/// @notice Deploys the implementation contract and factory. Does NOT create any markets.
contract Deploy is Script {
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        address oracleSigner = vm.envAddress("ORACLE_SIGNER_ADDRESS");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("=== OPick V6 Attention Market Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Oracle signer:", oracleSigner);
        console.log("USDC:", BASE_USDC);

        vm.startBroadcast(deployerKey);

        // 1. Deploy implementation
        OPickAttentionMarket implementation = new OPickAttentionMarket();
        console.log("Implementation:", address(implementation));

        // 2. Deploy factory
        OPickAttentionFactory factory = new OPickAttentionFactory(
            address(implementation),
            BASE_USDC,
            oracleSigner,
            deployer // treasury = deployer initially
        );
        console.log("Factory:", address(factory));

        vm.stopBroadcast();

        // Write deployment info
        string memory json = string.concat(
            '{"implementation":"', vm.toString(address(implementation)),
            '","factory":"', vm.toString(address(factory)),
            '","usdc":"', vm.toString(BASE_USDC),
            '","oracleSigner":"', vm.toString(oracleSigner),
            '","deployer":"', vm.toString(deployer),
            '","chainId":', vm.toString(block.chainid),
            "}"
        );
        vm.writeFile("deployments/base.json", json);
        console.log("Deployment saved to deployments/base.json");
    }
}
