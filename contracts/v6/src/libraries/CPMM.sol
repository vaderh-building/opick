// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CPMM - Constant Product Market Maker Library
/// @notice Implements constant product (x*y=k) AMM math matching OPick V5 curve.
/// @dev All amounts use USDC 6-decimal precision. Shares also use 6 decimals.
library CPMM {
    /// @notice Default initial reserve per side (3000 USDC).
    uint256 internal constant DEFAULT_INITIAL_RESERVE = 3_000e6;

    /// @notice Compute shares received when buying into one side of the curve.
    /// @param reserveIn Reserve of the side being bought into (receives USDC).
    /// @param reserveOut Reserve of the other side.
    /// @param amountIn USDC amount being deposited.
    /// @return sharesOut Number of shares minted to the buyer.
    /// @dev Matches V5 buyA/buyB formula: newReserveIn = reserveIn + amountIn,
    ///      newReserveOut = k / newReserveIn, sharesOut = reserveOut - newReserveOut.
    function getBuyOutput(
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 amountIn
    ) internal pure returns (uint256 sharesOut) {
        require(amountIn > 0, "CPMM: zero input");
        require(reserveIn > 0 && reserveOut > 0, "CPMM: zero reserve");
        uint256 k = reserveIn * reserveOut;
        uint256 newReserveIn = reserveIn + amountIn;
        uint256 newReserveOut = k / newReserveIn;
        sharesOut = reserveOut - newReserveOut;
        require(sharesOut > 0, "CPMM: zero output");
    }

    /// @notice Compute USDC received when selling shares back to the curve.
    /// @param reserveShares Reserve of the side whose shares are being sold.
    /// @param reserveUsdc Reserve of the other side (holds USDC).
    /// @param shareAmount Number of shares being sold.
    /// @return usdcOut USDC amount returned to the seller (before fees).
    /// @dev Matches V5 sellA/sellB formula: newReserveShares = reserveShares + shareAmount,
    ///      newReserveUsdc = k / newReserveShares, usdcOut = reserveUsdc - newReserveUsdc.
    function getSellOutput(
        uint256 reserveShares,
        uint256 reserveUsdc,
        uint256 shareAmount
    ) internal pure returns (uint256 usdcOut) {
        require(shareAmount > 0, "CPMM: zero shares");
        require(reserveShares > 0 && reserveUsdc > 0, "CPMM: zero reserve");
        uint256 k = reserveShares * reserveUsdc;
        uint256 newReserveShares = reserveShares + shareAmount;
        uint256 newReserveUsdc = k / newReserveShares;
        usdcOut = reserveUsdc - newReserveUsdc;
    }
}
