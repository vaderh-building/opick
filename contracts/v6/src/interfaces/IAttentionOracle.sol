// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IAttentionOracle - Interface for off-chain oracle data submission
/// @notice Documents the expected data structure for oracle settlement.
///         The oracle runs off-chain and submits signed attestations of attention metric values.
/// @dev On-chain verification uses ECDSA signature recovery against the authorized oracleSigner.
///      The signed payload is: keccak256(abi.encode(marketId, valueA, valueB, marketAddress, chainId))
///      where valueA and valueB are the engagement-weighted attention scores for the two keywords.
interface IAttentionOracle {
    /// @notice Settlement data submitted by the oracle.
    /// @param marketId The unique ID of the market being settled.
    /// @param valueA The attention metric value for keyword A (or the single keyword in DIRECTION markets).
    /// @param valueB The attention metric value for keyword B (zero for DIRECTION markets).
    /// @param signature ECDSA signature over the packed settlement data.
    struct SettlementData {
        uint256 marketId;
        uint256 valueA;
        uint256 valueB;
        bytes signature;
    }
}
