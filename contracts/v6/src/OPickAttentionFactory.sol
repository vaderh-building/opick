// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./OPickAttentionMarket.sol";

/// @title OPickAttentionFactory - Deploys oracle-settled attention markets via minimal proxy
/// @notice Curated market creation (onlyOwner). Each market is an ERC-1167 clone of the
///         implementation contract, initialized with market-specific parameters.
contract OPickAttentionFactory is Ownable {
    using SafeERC20 for IERC20;

    // -- Custom Errors --

    error ZeroAddress();
    error EmptyKeyword();
    error ZeroReserve();

    // -- Events --

    /// @notice Emitted when a new market is deployed.
    event MarketCreated(
        address indexed market,
        uint256 indexed marketId,
        OPickAttentionMarket.MarketType marketType,
        OPickAttentionMarket.MetricType metricType,
        bytes32 keywordA,
        bytes32 keywordB,
        uint256 threshold,
        uint256 initialReserve
    );

    /// @notice Maps a keyword hash to its original string for off-chain indexers.
    event KeywordRegistered(bytes32 indexed hash, string keyword);

    /// @notice Emitted when the oracle signer is updated.
    event OracleSignerUpdated(address indexed oldSigner, address indexed newSigner);

    // -- Storage --

    address public immutable implementation;
    IERC20 public immutable usdc;
    address public oracleSigner;
    address public treasury;

    address[] public markets;
    mapping(address => bool) public isMarket;
    uint256 public nextMarketId;

    uint256 public constant TRADING_DURATION = 7 days;
    uint256 public constant SETTLEMENT_WINDOW = 24 hours;

    // -- Constructor --

    /// @notice Deploy the factory with references to the implementation, USDC, oracle, and treasury.
    /// @param _implementation Address of the OPickAttentionMarket implementation to clone.
    /// @param _usdc USDC token address on Base mainnet.
    /// @param _oracleSigner Initial authorized oracle settlement signer.
    /// @param _treasury Protocol fee treasury address.
    constructor(
        address _implementation,
        address _usdc,
        address _oracleSigner,
        address _treasury
    ) Ownable(msg.sender) {
        if (_implementation == address(0)) revert ZeroAddress();
        if (_usdc == address(0)) revert ZeroAddress();
        if (_oracleSigner == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        implementation = _implementation;
        usdc = IERC20(_usdc);
        oracleSigner = _oracleSigner;
        treasury = _treasury;
    }

    // -- Market Creation --

    /// @notice Create a new attention market as a minimal proxy clone.
    /// @param _marketType HEAD_TO_HEAD or DIRECTION.
    /// @param _metricType The attention metric being tracked.
    /// @param _keywordA Primary keyword string (hashed and stored on-chain as bytes32).
    /// @param _keywordB Secondary keyword string (empty for DIRECTION markets).
    /// @param _threshold Threshold value for DIRECTION markets (zero for H2H).
    /// @param _initialReserve USDC amount to seed each side of the curve. Total cost = 2x this value.
    /// @return market Address of the deployed market clone.
    /// @return id Unique market ID.
    function createMarket(
        OPickAttentionMarket.MarketType _marketType,
        OPickAttentionMarket.MetricType _metricType,
        string calldata _keywordA,
        string calldata _keywordB,
        uint256 _threshold,
        uint256 _initialReserve
    ) external onlyOwner returns (address market, uint256 id) {
        if (bytes(_keywordA).length == 0) revert EmptyKeyword();
        if (_initialReserve == 0) revert ZeroReserve();

        id = nextMarketId++;
        bytes32 hashA = keccak256(bytes(_keywordA));
        bytes32 hashB = bytes(_keywordB).length > 0 ? keccak256(bytes(_keywordB)) : bytes32(0);

        // Deploy clone
        market = Clones.clone(implementation);

        // Transfer initial reserves (2x) from owner to the new market
        uint256 totalSeed = _initialReserve * 2;
        usdc.safeTransferFrom(msg.sender, market, totalSeed);

        // Initialize
        OPickAttentionMarket(market).initialize(
            id,
            _marketType,
            _metricType,
            hashA,
            hashB,
            _threshold,
            block.timestamp,                           // openTime
            block.timestamp + TRADING_DURATION,         // closeTime
            block.timestamp + TRADING_DURATION + SETTLEMENT_WINDOW, // settlementDeadline
            address(usdc),
            oracleSigner,
            treasury,
            owner(),
            _initialReserve
        );

        markets.push(market);
        isMarket[market] = true;

        // Emit keyword registrations for indexers
        emit KeywordRegistered(hashA, _keywordA);
        if (hashB != bytes32(0)) {
            emit KeywordRegistered(hashB, _keywordB);
        }

        emit MarketCreated(market, id, _marketType, _metricType, hashA, hashB, _threshold, _initialReserve);
    }

    // -- Admin --

    /// @notice Update the authorized oracle signer address.
    /// @param _newSigner New oracle signer.
    function setOracleSigner(address _newSigner) external onlyOwner {
        if (_newSigner == address(0)) revert ZeroAddress();
        address old = oracleSigner;
        oracleSigner = _newSigner;
        emit OracleSignerUpdated(old, _newSigner);
    }

    /// @notice Update the treasury address.
    /// @param _newTreasury New treasury.
    function setTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert ZeroAddress();
        treasury = _newTreasury;
    }

    // -- View --

    /// @notice Get all deployed market addresses.
    /// @return All market clone addresses.
    function getAllMarkets() external view returns (address[] memory) {
        return markets;
    }

    /// @notice Total number of markets created.
    /// @return Count of markets.
    function totalMarkets() external view returns (uint256) {
        return markets.length;
    }
}
