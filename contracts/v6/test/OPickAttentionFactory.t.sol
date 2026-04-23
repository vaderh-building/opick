// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/OPickAttentionFactory.sol";
import "../src/OPickAttentionMarket.sol";
import "../src/mocks/MockUSDC.sol";

contract OPickAttentionFactoryTest is Test {
    MockUSDC usdc;
    OPickAttentionFactory factory;
    OPickAttentionMarket impl;

    address owner = address(this);
    address oracle = address(0xCAFE);
    address treasury = address(0xBEEF);

    function setUp() public {
        usdc = new MockUSDC();
        impl = new OPickAttentionMarket();
        factory = new OPickAttentionFactory(address(impl), address(usdc), oracle, treasury);
        usdc.mint(owner, 1_000_000e6);
        usdc.approve(address(factory), type(uint256).max);
    }

    function test_createMarket_deploysClone() public {
        (address market, uint256 id) = factory.createMarket(
            OPickAttentionMarket.MarketType.HEAD_TO_HEAD,
            OPickAttentionMarket.MetricType.ENGAGEMENT_WEIGHTED,
            "Elon Musk", "Sam Altman", 0, 3000e6
        );
        assertTrue(market != address(0));
        assertEq(id, 0);
        assertEq(factory.totalMarkets(), 1);
        assertTrue(factory.isMarket(market));
    }

    function test_createMarket_incrementsId() public {
        factory.createMarket(
            OPickAttentionMarket.MarketType.HEAD_TO_HEAD,
            OPickAttentionMarket.MetricType.MENTION_COUNT,
            "A", "B", 0, 3000e6
        );
        (, uint256 id2) = factory.createMarket(
            OPickAttentionMarket.MarketType.DIRECTION,
            OPickAttentionMarket.MetricType.VELOCITY,
            "C", "", 100, 3000e6
        );
        assertEq(id2, 1);
        assertEq(factory.totalMarkets(), 2);
    }

    function test_createMarket_revertsIfNotOwner() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert();
        factory.createMarket(
            OPickAttentionMarket.MarketType.HEAD_TO_HEAD,
            OPickAttentionMarket.MetricType.MENTION_COUNT,
            "A", "B", 0, 3000e6
        );
    }

    function test_createMarket_revertsIfEmptyKeyword() public {
        vm.expectRevert(OPickAttentionFactory.EmptyKeyword.selector);
        factory.createMarket(
            OPickAttentionMarket.MarketType.HEAD_TO_HEAD,
            OPickAttentionMarket.MetricType.MENTION_COUNT,
            "", "B", 0, 3000e6
        );
    }

    function test_createMarket_revertsIfZeroReserve() public {
        vm.expectRevert(OPickAttentionFactory.ZeroReserve.selector);
        factory.createMarket(
            OPickAttentionMarket.MarketType.HEAD_TO_HEAD,
            OPickAttentionMarket.MetricType.MENTION_COUNT,
            "A", "B", 0, 0
        );
    }

    function test_setOracleSigner_updatesAddress() public {
        address newOracle = address(0x1234);
        factory.setOracleSigner(newOracle);
        assertEq(factory.oracleSigner(), newOracle);
    }

    function test_getAllMarkets_returnsAllAddresses() public {
        factory.createMarket(
            OPickAttentionMarket.MarketType.HEAD_TO_HEAD,
            OPickAttentionMarket.MetricType.MENTION_COUNT,
            "A", "B", 0, 3000e6
        );
        factory.createMarket(
            OPickAttentionMarket.MarketType.DIRECTION,
            OPickAttentionMarket.MetricType.MENTION_COUNT,
            "C", "", 100, 3000e6
        );
        address[] memory all = factory.getAllMarkets();
        assertEq(all.length, 2);
    }
}
