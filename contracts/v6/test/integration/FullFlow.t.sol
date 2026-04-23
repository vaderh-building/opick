// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/OPickAttentionFactory.sol";
import "../../src/OPickAttentionMarket.sol";
import "../../src/mocks/MockUSDC.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract FullFlowTest is Test {
    MockUSDC usdc;
    OPickAttentionFactory factory;
    OPickAttentionMarket impl;

    address owner = address(this);
    uint256 oracleKey = 0xA11CE;
    address oracleSigner;
    address treasury = address(0xBEEF);
    address alice = address(0xA1);
    address bob = address(0xB0B);

    uint256 constant INIT = 3000e6;

    function setUp() public {
        oracleSigner = vm.addr(oracleKey);
        usdc = new MockUSDC();
        impl = new OPickAttentionMarket();
        factory = new OPickAttentionFactory(address(impl), address(usdc), oracleSigner, treasury);
        usdc.mint(owner, 100_000e6);
        usdc.approve(address(factory), type(uint256).max);
        usdc.mint(alice, 50_000e6);
        usdc.mint(bob, 50_000e6);
    }

    function _sign(uint256 id, uint256 vA, uint256 vB, address m) internal view returns (bytes memory) {
        bytes32 d = keccak256(abi.encode(id, vA, vB, m, block.chainid));
        bytes32 h = MessageHashUtils.toEthSignedMessageHash(d);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oracleKey, h);
        return abi.encodePacked(r, s, v);
    }

    function test_fullLifecycle_h2h() public {
        // Create market
        (address addr, uint256 id) = factory.createMarket(
            OPickAttentionMarket.MarketType.HEAD_TO_HEAD,
            OPickAttentionMarket.MetricType.ENGAGEMENT_WEIGHTED,
            "Elon Musk", "Sam Altman", 0, INIT
        );
        OPickAttentionMarket m = OPickAttentionMarket(addr);

        // Alice buys YES (500 USDC)
        vm.startPrank(alice);
        usdc.approve(addr, type(uint256).max);
        uint256 aliceShares = m.buy(true, 500e6, 0);
        vm.stopPrank();

        // Bob buys NO (300 USDC)
        vm.startPrank(bob);
        usdc.approve(addr, type(uint256).max);
        m.buy(false, 300e6, 0);
        vm.stopPrank();

        // Time passes, trading closes
        vm.warp(m.closeTime() + 1);
        m.requestSettlement();

        // Oracle settles: keyword A (Musk) wins
        bytes memory sig = _sign(id, 845000, 59000, addr);
        m.submitSettlement(845000, 59000, sig);
        assertTrue(m.yesWon());

        // Alice claims (she had YES, she wins)
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        m.claim();
        uint256 alicePayout = usdc.balanceOf(alice) - aliceBefore;
        assertTrue(alicePayout > 0);

        // Bob cannot claim (he had NO, he loses)
        vm.prank(bob);
        vm.expectRevert(OPickAttentionMarket.NothingToClaim.selector);
        m.claim();

        // Treasury received protocol fees
        assertTrue(usdc.balanceOf(treasury) > 0);
    }

    function test_fullLifecycle_direction() public {
        (address addr, uint256 id) = factory.createMarket(
            OPickAttentionMarket.MarketType.DIRECTION,
            OPickAttentionMarket.MetricType.MENTION_COUNT,
            "Bitcoin", "", 100000, INIT
        );
        OPickAttentionMarket m = OPickAttentionMarket(addr);

        vm.startPrank(alice);
        usdc.approve(addr, type(uint256).max);
        m.buy(true, 200e6, 0); // YES: Bitcoin mentions > 100k
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(addr, type(uint256).max);
        m.buy(false, 200e6, 0); // NO
        vm.stopPrank();

        vm.warp(m.closeTime() + 1);
        m.requestSettlement();

        // Oracle: Bitcoin got 150k mentions (over threshold)
        bytes memory sig = _sign(id, 150000, 0, addr);
        m.submitSettlement(150000, 0, sig);
        assertTrue(m.yesWon());

        vm.prank(alice);
        m.claim();
        assertTrue(usdc.balanceOf(alice) > 50_000e6 - 200e6); // got back more than deposit
    }

    function test_fullLifecycle_dispute() public {
        (address addr,) = factory.createMarket(
            OPickAttentionMarket.MarketType.HEAD_TO_HEAD,
            OPickAttentionMarket.MetricType.ENGAGEMENT_WEIGHTED,
            "A", "B", 0, INIT
        );
        OPickAttentionMarket m = OPickAttentionMarket(addr);

        vm.startPrank(alice);
        usdc.approve(addr, type(uint256).max);
        m.buy(true, 500e6, 0);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(addr, type(uint256).max);
        m.buy(false, 300e6, 0);
        vm.stopPrank();

        uint256 aliceDepositTotal = 500e6;
        uint256 bobDepositTotal = 300e6;

        // Trading closes
        vm.warp(m.closeTime() + 1);
        m.requestSettlement();

        // Oracle never submits. Warp past deadline + 48h grace.
        vm.warp(m.settlementDeadline() + 48 hours + 1);
        m.dispute();
        assertEq(uint8(m.state()), uint8(OPickAttentionMarket.MarketState.DISPUTED));

        // Both users can claim refunds (pro-rata of available balance)
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        m.claim();
        uint256 aliceRefund = usdc.balanceOf(alice) - aliceBefore;
        assertTrue(aliceRefund > 0);

        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        m.claim();
        uint256 bobRefund = usdc.balanceOf(bob) - bobBefore;
        assertTrue(bobRefund > 0);
    }
}
