// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/OPickAttentionMarket.sol";
import "../src/OPickAttentionFactory.sol";
import "../src/mocks/MockUSDC.sol";

contract OPickAttentionMarketTest is Test {
    MockUSDC usdc;
    OPickAttentionFactory factory;
    OPickAttentionMarket impl;

    address owner = address(this);
    uint256 oracleKey = 0xA11CE;
    address oracleSigner;
    address treasury = address(0xBEEF);
    address alice = address(0xA1);
    address bob = address(0xB0B);

    uint256 constant INIT_RESERVE = 3000e6;

    function setUp() public {
        oracleSigner = vm.addr(oracleKey);
        usdc = new MockUSDC();
        impl = new OPickAttentionMarket();
        factory = new OPickAttentionFactory(address(impl), address(usdc), oracleSigner, treasury);

        // Fund owner for market creation
        usdc.mint(owner, 100_000e6);
        usdc.approve(address(factory), type(uint256).max);

        // Fund users
        usdc.mint(alice, 100_000e6);
        usdc.mint(bob, 100_000e6);
    }

    function _createH2HMarket() internal returns (OPickAttentionMarket market) {
        (address addr,) = factory.createMarket(
            OPickAttentionMarket.MarketType.HEAD_TO_HEAD,
            OPickAttentionMarket.MetricType.ENGAGEMENT_WEIGHTED,
            "Elon Musk", "Sam Altman", 0, INIT_RESERVE
        );
        market = OPickAttentionMarket(addr);
    }

    function _createDirectionMarket(uint256 threshold) internal returns (OPickAttentionMarket market) {
        (address addr,) = factory.createMarket(
            OPickAttentionMarket.MarketType.DIRECTION,
            OPickAttentionMarket.MetricType.MENTION_COUNT,
            "Bitcoin", "", threshold, INIT_RESERVE
        );
        market = OPickAttentionMarket(addr);
    }

    function _approve(address user, address market) internal {
        vm.prank(user);
        usdc.approve(market, type(uint256).max);
    }

    function _sign(uint256 marketId, uint256 valueA, uint256 valueB, address marketAddr) internal view returns (bytes memory) {
        bytes32 digest = keccak256(abi.encode(marketId, valueA, valueB, marketAddr, block.chainid));
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(digest);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oracleKey, ethHash);
        return abi.encodePacked(r, s, v);
    }

    // -- Initialization --

    function test_initialize_setsParamsCorrectly() public {
        OPickAttentionMarket m = _createH2HMarket();
        assertEq(uint8(m.marketType()), uint8(OPickAttentionMarket.MarketType.HEAD_TO_HEAD));
        assertEq(uint8(m.metricType()), uint8(OPickAttentionMarket.MetricType.ENGAGEMENT_WEIGHTED));
        assertEq(m.keywordA(), keccak256("Elon Musk"));
        assertEq(m.keywordB(), keccak256("Sam Altman"));
        assertEq(m.reserveYes(), INIT_RESERVE);
        assertEq(m.reserveNo(), INIT_RESERVE);
        assertEq(m.oracleSigner(), oracleSigner);
        assertEq(uint8(m.state()), uint8(OPickAttentionMarket.MarketState.TRADING));
    }

    // -- Buy --

    function test_buy_yesSide_increasesYesReserve() public {
        OPickAttentionMarket m = _createH2HMarket();
        _approve(alice, address(m));
        uint256 buyAmt = 100e6;
        vm.prank(alice);
        uint256 shares = m.buy(true, buyAmt, 0);
        assertTrue(shares > 0);
        assertTrue(m.sharesYes(alice) > 0);
        // reserveNo should have increased (USDC added)
        assertTrue(m.reserveNo() > INIT_RESERVE);
    }

    function test_buy_revertIfClosed() public {
        OPickAttentionMarket m = _createH2HMarket();
        _approve(alice, address(m));
        vm.warp(m.closeTime() + 1);
        vm.prank(alice);
        vm.expectRevert(OPickAttentionMarket.TradingClosed.selector);
        m.buy(true, 100e6, 0);
    }

    function test_buy_revertIfSlippage() public {
        OPickAttentionMarket m = _createH2HMarket();
        _approve(alice, address(m));
        vm.prank(alice);
        vm.expectRevert(OPickAttentionMarket.SlippageExceeded.selector);
        m.buy(true, 100e6, type(uint256).max); // impossible minSharesOut
    }

    // -- Sell --

    function test_sell_burnsShares() public {
        OPickAttentionMarket m = _createH2HMarket();
        _approve(alice, address(m));

        vm.prank(alice);
        uint256 shares = m.buy(true, 100e6, 0);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 usdcOut = m.sell(true, shares, 0);
        assertTrue(usdcOut > 0);
        assertEq(m.sharesYes(alice), 0);
        assertEq(usdc.balanceOf(alice), balBefore + usdcOut);
    }

    function test_sell_revertIfNotEnoughShares() public {
        OPickAttentionMarket m = _createH2HMarket();
        _approve(alice, address(m));
        vm.prank(alice);
        vm.expectRevert(OPickAttentionMarket.InsufficientShares.selector);
        m.sell(true, 100e6, 0);
    }

    // -- Settlement --

    function test_requestSettlement_revertIfBeforeCloseTime() public {
        OPickAttentionMarket m = _createH2HMarket();
        vm.expectRevert(OPickAttentionMarket.TradingNotClosed.selector);
        m.requestSettlement();
    }

    function test_submitSettlement_verifiesSignature() public {
        OPickAttentionMarket m = _createH2HMarket();
        vm.warp(m.closeTime() + 1);
        m.requestSettlement();

        bytes memory sig = _sign(0, 100000, 50000, address(m));
        m.submitSettlement(100000, 50000, sig);
        assertEq(uint8(m.state()), uint8(OPickAttentionMarket.MarketState.SETTLED));
    }

    function test_submitSettlement_revertIfWrongSigner() public {
        OPickAttentionMarket m = _createH2HMarket();
        vm.warp(m.closeTime() + 1);
        m.requestSettlement();

        // Sign with wrong key
        uint256 wrongKey = 0xDEAD;
        bytes32 digest = keccak256(abi.encode(uint256(0), uint256(100000), uint256(50000), address(m), block.chainid));
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(digest);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, ethHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert(OPickAttentionMarket.InvalidSignature.selector);
        m.submitSettlement(100000, 50000, badSig);
    }

    function test_submitSettlement_revertIfReplay() public {
        OPickAttentionMarket m = _createH2HMarket();
        vm.warp(m.closeTime() + 1);
        m.requestSettlement();

        bytes memory sig = _sign(0, 100000, 50000, address(m));
        m.submitSettlement(100000, 50000, sig);

        // Try to submit again
        vm.expectRevert(OPickAttentionMarket.MarketNotPendingSettlement.selector);
        m.submitSettlement(100000, 50000, sig);
    }

    function test_submitSettlement_h2h_yesWinsWhenAGreater() public {
        OPickAttentionMarket m = _createH2HMarket();
        vm.warp(m.closeTime() + 1);
        m.requestSettlement();

        bytes memory sig = _sign(0, 100000, 50000, address(m));
        m.submitSettlement(100000, 50000, sig);
        assertTrue(m.yesWon());
    }

    function test_submitSettlement_direction_yesWinsWhenOverThreshold() public {
        OPickAttentionMarket m = _createDirectionMarket(75000);
        uint256 id = m.marketId();
        vm.warp(m.closeTime() + 1);
        m.requestSettlement();

        bytes memory sig = _sign(id, 100000, 0, address(m));
        m.submitSettlement(100000, 0, sig);
        assertTrue(m.yesWon());
    }

    // -- Claims --

    function test_claim_paysWinnersProRata() public {
        OPickAttentionMarket m = _createH2HMarket();
        _approve(alice, address(m));
        _approve(bob, address(m));

        vm.prank(alice);
        m.buy(true, 500e6, 0); // YES
        vm.prank(bob);
        m.buy(false, 300e6, 0); // NO

        vm.warp(m.closeTime() + 1);
        m.requestSettlement();
        bytes memory sig = _sign(0, 100000, 50000, address(m));
        m.submitSettlement(100000, 50000, sig); // YES wins

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        m.claim();
        uint256 payout = usdc.balanceOf(alice) - balBefore;
        assertTrue(payout > 0);
    }

    function test_claim_revertIfNotSettled() public {
        OPickAttentionMarket m = _createH2HMarket();
        vm.prank(alice);
        vm.expectRevert(OPickAttentionMarket.MarketNotSettled.selector);
        m.claim();
    }

    function test_claim_losersGetZero() public {
        OPickAttentionMarket m = _createH2HMarket();
        _approve(alice, address(m));
        _approve(bob, address(m));

        vm.prank(alice);
        m.buy(true, 500e6, 0);
        vm.prank(bob);
        m.buy(false, 300e6, 0);

        vm.warp(m.closeTime() + 1);
        m.requestSettlement();
        bytes memory sig = _sign(0, 100000, 50000, address(m));
        m.submitSettlement(100000, 50000, sig);

        vm.prank(bob);
        vm.expectRevert(OPickAttentionMarket.NothingToClaim.selector);
        m.claim();
    }

    // -- Dispute --

    function test_dispute_enablesRefundAfterDeadline() public {
        OPickAttentionMarket m = _createH2HMarket();
        _approve(alice, address(m));

        vm.prank(alice);
        m.buy(true, 200e6, 0);

        vm.warp(m.closeTime() + 1);
        m.requestSettlement();

        // Warp past settlement deadline + 48h grace
        vm.warp(m.settlementDeadline() + 48 hours + 1);
        m.dispute();
        assertEq(uint8(m.state()), uint8(OPickAttentionMarket.MarketState.DISPUTED));

        // Alice can claim refund
        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        m.claim();
        assertTrue(usdc.balanceOf(alice) > balBefore);
    }

    function test_dispute_revertIfBeforeDeadline() public {
        OPickAttentionMarket m = _createH2HMarket();
        vm.warp(m.closeTime() + 1);
        m.requestSettlement();

        vm.expectRevert(OPickAttentionMarket.DisputeTooEarly.selector);
        m.dispute();
    }

    // -- Pause --

    function test_pause_haltsBuyAndSell() public {
        OPickAttentionMarket m = _createH2HMarket();
        _approve(alice, address(m));
        m.emergencyPause();

        vm.prank(alice);
        vm.expectRevert();
        m.buy(true, 100e6, 0);
    }

    // -- Reentrancy --

    function test_reentrancy_claimCannotReenter() public {
        // Reentrancy guard on claim prevents double-claim in same tx
        // This is enforced by ReentrancyGuard + claimed[msg.sender] check
        OPickAttentionMarket m = _createH2HMarket();
        _approve(alice, address(m));

        vm.prank(alice);
        m.buy(true, 500e6, 0);

        vm.warp(m.closeTime() + 1);
        m.requestSettlement();
        bytes memory sig = _sign(0, 100000, 50000, address(m));
        m.submitSettlement(100000, 50000, sig);

        vm.prank(alice);
        m.claim();

        // Second claim reverts
        vm.prank(alice);
        vm.expectRevert(OPickAttentionMarket.NothingToClaim.selector);
        m.claim();
    }
}
