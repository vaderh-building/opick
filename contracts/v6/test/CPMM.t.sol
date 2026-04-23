// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/libraries/CPMM.sol";

// Helper contract to test library reverts (library calls inline and revert before expectRevert can catch)
contract CPMMCaller {
    function buyOutput(uint256 rIn, uint256 rOut, uint256 amt) external pure returns (uint256) {
        return CPMM.getBuyOutput(rIn, rOut, amt);
    }
    function sellOutput(uint256 rShares, uint256 rUsdc, uint256 shares) external pure returns (uint256) {
        return CPMM.getSellOutput(rShares, rUsdc, shares);
    }
}

contract CPMMTest is Test {
    uint256 constant R = 3000e6;
    CPMMCaller caller;

    function setUp() public {
        caller = new CPMMCaller();
    }

    function test_getBuyOutput_returnsPositive() public view {
        uint256 out = CPMM.getBuyOutput(R, R, 100e6);
        assertTrue(out > 0);
        assertTrue(out < R);
    }

    function test_getBuyOutput_revertsOnZeroInput() public {
        vm.expectRevert("CPMM: zero input");
        caller.buyOutput(R, R, 0);
    }

    function test_getBuyOutput_revertsOnZeroReserve() public {
        vm.expectRevert("CPMM: zero reserve");
        caller.buyOutput(0, R, 100e6);
    }

    function test_getSellOutput_returnsPositive() public view {
        uint256 out = CPMM.getSellOutput(R, R, 100e6);
        assertTrue(out > 0);
    }

    function test_getSellOutput_revertsOnZeroShares() public {
        vm.expectRevert("CPMM: zero shares");
        caller.sellOutput(R, R, 0);
    }

    function testFuzz_cpmmInvariant(uint256 buyAmount) public view {
        buyAmount = bound(buyAmount, 1e6, 1_000_000e6);
        uint256 k = R * R;
        uint256 shares = CPMM.getBuyOutput(R, R, buyAmount);
        uint256 newReserveIn = R + buyAmount;
        uint256 newReserveOut = R - shares;
        uint256 newK = newReserveIn * newReserveOut;
        // Integer division in k/newReserveIn can lose at most (newReserveIn - 1) units,
        // so newK >= k - newReserveIn is the true bound. For practical amounts, check
        // that k does not decrease by more than a negligible fraction.
        assertTrue(newK + newReserveIn >= k, "k decreased beyond rounding tolerance");
    }

    function test_buyThenSell_roundTrip() public view {
        uint256 buyAmt = 100e6;
        // Buy: USDC goes into reserveIn (reserveNo), shares come from reserveOut (reserveYes)
        uint256 shares = CPMM.getBuyOutput(R, R, buyAmt);
        uint256 newResIn = R + buyAmt;
        uint256 newResOut = R - shares;
        // Sell: shares go back into reserveShares (reserveYes), USDC comes from reserveUsdc (reserveNo)
        uint256 sellOut = CPMM.getSellOutput(newResOut, newResIn, shares);
        // Sell output should be close to buy input, potentially slightly less due to rounding.
        // With 3000e6 reserves and 100e6 buy, rounding loss is negligible.
        assertTrue(sellOut <= buyAmt + 1, "sell returned more than buy input"); // +1 for rounding
        assertTrue(sellOut >= buyAmt - 1, "sell returned significantly less than buy input");
    }
}
