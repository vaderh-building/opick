// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../src/OPickAttentionFactory.sol";
import "../src/OPickAttentionMarket.sol";

/// @title CreateMarket - Helper script for creating attention markets from CLI
/// @notice Usage:
///   forge script script/CreateMarket.s.sol --sig "run(uint8,uint8,string,string,uint256,uint256)" \
///     0 2 "Elon Musk" "Sam Altman" 0 3000000000 --rpc-url base --broadcast
contract CreateMarket is Script {
    function run(
        uint8 marketType,
        uint8 metricType,
        string calldata keywordA,
        string calldata keywordB,
        uint256 threshold,
        uint256 initialReserve
    ) external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address factoryAddr = vm.envAddress("FACTORY_ADDRESS");

        OPickAttentionFactory factory = OPickAttentionFactory(factoryAddr);
        IERC20 usdc = factory.usdc();
        uint256 totalCost = initialReserve * 2;

        console.log("Creating market on factory:", factoryAddr);
        console.log("Keyword A:", keywordA);
        console.log("Keyword B:", keywordB);
        console.log("Initial reserve per side:", initialReserve);
        console.log("Total USDC cost:", totalCost);

        vm.startBroadcast(deployerKey);

        usdc.approve(factoryAddr, totalCost);
        (address market, uint256 id) = factory.createMarket(
            OPickAttentionMarket.MarketType(marketType),
            OPickAttentionMarket.MetricType(metricType),
            keywordA,
            keywordB,
            threshold,
            initialReserve
        );

        vm.stopBroadcast();

        console.log("Market created:");
        console.log("  Address:", market);
        console.log("  ID:", id);
    }
}
