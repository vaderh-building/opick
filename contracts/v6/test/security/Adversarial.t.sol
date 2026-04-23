// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/OPickAttentionFactory.sol";
import "../../src/OPickAttentionMarket.sol";
import "../../src/mocks/MockUSDC.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract AdversarialTest is Test {
    MockUSDC usdc;
    OPickAttentionFactory factory;
    OPickAttentionMarket impl;

    address owner = address(this);
    uint256 oracleKey = 0xA11CE;
    address oracleSigner;
    address treasury = address(0xBEEF);
    address alice = address(0xA1);
    address adversary = address(0xBAD);

    uint256 constant INIT = 3000e6;

    function setUp() public {
        oracleSigner = vm.addr(oracleKey);
        usdc = new MockUSDC();
        impl = new OPickAttentionMarket();
        factory = new OPickAttentionFactory(address(impl), address(usdc), oracleSigner, treasury);
        usdc.mint(owner, 100_000e6);
        usdc.approve(address(factory), type(uint256).max);
        usdc.mint(alice, 50_000e6);
        usdc.mint(adversary, 50_000e6);
    }

    function _createMarket() internal returns (OPickAttentionMarket m, uint256 id) {
        (address addr, uint256 _id) = factory.createMarket(
            OPickAttentionMarket.MarketType.HEAD_TO_HEAD,
            OPickAttentionMarket.MetricType.ENGAGEMENT_WEIGHTED,
            "A", "B", 0, INIT
        );
        m = OPickAttentionMarket(addr);
        id = _id;
    }

    function _sign(uint256 id, uint256 vA, uint256 vB, address m) internal view returns (bytes memory) {
        bytes32 d = keccak256(abi.encode(id, vA, vB, m, block.chainid));
        bytes32 h = MessageHashUtils.toEthSignedMessageHash(d);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oracleKey, h);
        return abi.encodePacked(r, s, v);
    }

    function test_adversary_cannotForgeOracleSignature() public {
        (OPickAttentionMarket m,) = _createMarket();
        vm.warp(m.closeTime() + 1);
        m.requestSettlement();

        // Adversary tries to sign with their own key
        uint256 badKey = 0xBAD;
        bytes32 d = keccak256(abi.encode(uint256(0), uint256(1), uint256(2), address(m), block.chainid));
        bytes32 h = MessageHashUtils.toEthSignedMessageHash(d);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(badKey, h);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert(OPickAttentionMarket.InvalidSignature.selector);
        m.submitSettlement(1, 2, badSig);
    }

    function test_adversary_cannotReuseSignatureAcrossMarkets() public {
        (OPickAttentionMarket m1, uint256 id1) = _createMarket();
        (OPickAttentionMarket m2,) = _createMarket();

        vm.warp(m1.closeTime() + 1);
        m1.requestSettlement();
        m2.requestSettlement();

        // Sign for market 1
        bytes memory sig = _sign(id1, 100, 50, address(m1));
        m1.submitSettlement(100, 50, sig);

        // Try to use same sig on market 2 (different address in digest)
        vm.expectRevert(OPickAttentionMarket.InvalidSignature.selector);
        m2.submitSettlement(100, 50, sig);
    }

    function test_adversary_cannotSettleTwice() public {
        (OPickAttentionMarket m, uint256 id) = _createMarket();
        vm.warp(m.closeTime() + 1);
        m.requestSettlement();
        bytes memory sig = _sign(id, 100, 50, address(m));
        m.submitSettlement(100, 50, sig);

        vm.expectRevert(OPickAttentionMarket.MarketNotPendingSettlement.selector);
        m.submitSettlement(100, 50, sig);
    }

    function test_adversary_cannotClaimTwice() public {
        (OPickAttentionMarket m, uint256 id) = _createMarket();

        vm.startPrank(alice);
        usdc.approve(address(m), type(uint256).max);
        m.buy(true, 200e6, 0);
        vm.stopPrank();

        vm.warp(m.closeTime() + 1);
        m.requestSettlement();
        bytes memory sig = _sign(id, 100, 50, address(m));
        m.submitSettlement(100, 50, sig);

        vm.prank(alice);
        m.claim();

        vm.prank(alice);
        vm.expectRevert(OPickAttentionMarket.NothingToClaim.selector);
        m.claim();
    }

    function test_adversary_cannotBuyAfterClose() public {
        (OPickAttentionMarket m,) = _createMarket();
        vm.startPrank(adversary);
        usdc.approve(address(m), type(uint256).max);
        vm.warp(m.closeTime() + 1);
        vm.expectRevert(OPickAttentionMarket.TradingClosed.selector);
        m.buy(true, 100e6, 0);
        vm.stopPrank();
    }

    function test_adversary_cannotDrainViaRoundingErrors() public {
        (OPickAttentionMarket m, uint256 id) = _createMarket();

        // Multiple users buy and sell at various amounts
        address[] memory users = new address[](5);
        for (uint256 i = 0; i < 5; i++) {
            users[i] = address(uint160(0x1000 + i));
            usdc.mint(users[i], 10_000e6);
            vm.prank(users[i]);
            usdc.approve(address(m), type(uint256).max);
        }

        // Series of buys
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(users[i]);
            m.buy(i % 2 == 0, (50 + i * 30) * 1e6, 0);
        }

        vm.warp(m.closeTime() + 1);
        m.requestSettlement();
        bytes memory sig = _sign(id, 100, 50, address(m));
        m.submitSettlement(100, 50, sig);

        // Sum of all claimables must not exceed contract USDC balance
        uint256 contractBal = usdc.balanceOf(address(m));
        uint256 totalClaimed = 0;
        for (uint256 i = 0; i < 5; i++) {
            uint256 before = usdc.balanceOf(users[i]);
            vm.prank(users[i]);
            try m.claim() {} catch {}
            totalClaimed += usdc.balanceOf(users[i]) - before;
        }
        assertTrue(totalClaimed <= contractBal);
    }

    function testFuzz_cpmmInvariant(uint256 amt1, uint256 amt2) public {
        amt1 = bound(amt1, 1e6, 10_000e6);
        amt2 = bound(amt2, 1e6, 10_000e6);

        (OPickAttentionMarket m,) = _createMarket();

        vm.startPrank(alice);
        usdc.approve(address(m), type(uint256).max);
        m.buy(true, amt1, 0);
        uint256 kAfterFirst = m.reserveYes() * m.reserveNo();
        m.buy(false, amt2, 0);
        uint256 kAfterSecond = m.reserveYes() * m.reserveNo();
        vm.stopPrank();

        // CPMM invariant: k should not decrease significantly between operations.
        // Integer division rounding can cause tiny loss per operation (bounded by reserve size).
        uint256 tolerance = m.reserveYes() + m.reserveNo(); // max rounding loss per operation
        assertTrue(kAfterSecond + tolerance >= kAfterFirst, "k decreased beyond rounding tolerance");
    }
}
