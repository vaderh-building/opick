// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./libraries/CPMM.sol";

/// @title OPickAttentionMarket - Oracle-settled attention market with CPMM pricing
/// @notice Each instance represents a single attention market where users trade YES/NO shares
///         on attention metrics. Settlement is driven by an off-chain oracle.
/// @dev Deployed as minimal proxy (ERC-1167) clones by OPickAttentionFactory.
contract OPickAttentionMarket is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // -- Enums --

    enum MetricType { MENTION_COUNT, ENGAGEMENT_WEIGHTED, ENGAGEMENT_DENSITY, VELOCITY }
    enum MarketType { HEAD_TO_HEAD, DIRECTION }
    enum MarketState { TRADING, PENDING_SETTLEMENT, SETTLED, DISPUTED }

    // -- Custom Errors --

    error NotInitialized();
    error AlreadyInitialized();
    error MarketNotTrading();
    error MarketNotPendingSettlement();
    error MarketNotSettled();
    error TradingNotClosed();
    error TradingClosed();
    error SlippageExceeded();
    error InsufficientShares();
    error InvalidSignature();
    error NothingToClaim();
    error DisputeTooEarly();
    error OnlyOwner();
    error ZeroAmount();

    // -- Events --

    /// @notice Emitted when a user buys shares.
    event SharesBought(address indexed buyer, bool indexed yesSide, uint256 usdcIn, uint256 sharesOut);

    /// @notice Emitted when a user sells shares.
    event SharesSold(address indexed seller, bool indexed yesSide, uint256 sharesIn, uint256 usdcOut);

    /// @notice Emitted when trading closes and settlement is requested.
    event SettlementRequested(uint256 indexed marketId, uint256 closeTime);

    /// @notice Emitted when the oracle submits settlement values and the market resolves.
    event Settled(uint256 indexed marketId, bool yesWon, uint256 valueA, uint256 valueB);

    /// @notice Emitted when a user claims their payout.
    event Claimed(address indexed user, uint256 amount);

    /// @notice Emitted when the market enters dispute mode (oracle failed to settle).
    event Disputed(uint256 indexed marketId);

    // -- Storage --

    bool public initialized;
    address public owner;
    IERC20 public usdc;
    address public oracleSigner;
    address public treasury;

    uint256 public marketId;
    MarketType public marketType;
    MetricType public metricType;
    bytes32 public keywordA;
    bytes32 public keywordB;
    uint256 public threshold;

    uint256 public openTime;
    uint256 public closeTime;
    uint256 public settlementDeadline;

    uint256 public reserveYes;
    uint256 public reserveNo;
    uint256 public totalShareYes;
    uint256 public totalShareNo;
    uint256 public protocolFeesCollected;

    MarketState public state;
    bool public yesWon;
    uint256 public settlementValueA;
    uint256 public settlementValueB;

    mapping(address => uint256) public sharesYes;
    mapping(address => uint256) public sharesNo;
    mapping(address => uint256) public depositsYes;
    mapping(address => uint256) public depositsNo;
    mapping(address => bool) public claimed;

    uint256 public constant FEE_BPS = 100; // 1%
    uint256 public constant BPS = 10_000;
    uint256 public constant DISPUTE_GRACE = 48 hours;

    // -- Initialization --

    /// @notice Initialize the market (called once by factory via clone).
    /// @param _marketId Unique market identifier.
    /// @param _marketType HEAD_TO_HEAD or DIRECTION.
    /// @param _metricType The attention metric being tracked.
    /// @param _keywordA Hash of keyword A.
    /// @param _keywordB Hash of keyword B (zero for DIRECTION).
    /// @param _threshold Value threshold for DIRECTION markets (zero for H2H).
    /// @param _openTime When trading opens.
    /// @param _closeTime When trading closes.
    /// @param _settlementDeadline When oracle must submit by.
    /// @param _usdc USDC token address.
    /// @param _oracleSigner Authorized settlement signer.
    /// @param _treasury Protocol treasury for fees.
    /// @param _owner Contract owner (can pause).
    /// @param _initialReserve Initial reserve per side (USDC must already be transferred).
    function initialize(
        uint256 _marketId,
        MarketType _marketType,
        MetricType _metricType,
        bytes32 _keywordA,
        bytes32 _keywordB,
        uint256 _threshold,
        uint256 _openTime,
        uint256 _closeTime,
        uint256 _settlementDeadline,
        address _usdc,
        address _oracleSigner,
        address _treasury,
        address _owner,
        uint256 _initialReserve
    ) external {
        if (initialized) revert AlreadyInitialized();
        initialized = true;

        marketId = _marketId;
        marketType = _marketType;
        metricType = _metricType;
        keywordA = _keywordA;
        keywordB = _keywordB;
        threshold = _threshold;
        openTime = _openTime;
        closeTime = _closeTime;
        settlementDeadline = _settlementDeadline;
        usdc = IERC20(_usdc);
        oracleSigner = _oracleSigner;
        treasury = _treasury;
        owner = _owner;

        // Set initial reserves (USDC already transferred by factory)
        reserveYes = _initialReserve;
        reserveNo = _initialReserve;
        // Mint initial shares to burn address so there is always liquidity
        totalShareYes = _initialReserve;
        totalShareNo = _initialReserve;

        state = MarketState.TRADING;
    }

    // -- Modifiers --

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyInitialized() {
        if (!initialized) revert NotInitialized();
        _;
    }

    // -- Trading --

    /// @notice Buy YES or NO shares using USDC.
    /// @param yesSide True to buy YES shares, false for NO.
    /// @param usdcAmount Amount of USDC to spend.
    /// @param minSharesOut Minimum shares to receive (slippage protection).
    /// @return sharesOut Actual shares received.
    function buy(bool yesSide, uint256 usdcAmount, uint256 minSharesOut)
        external
        nonReentrant
        whenNotPaused
        onlyInitialized
        returns (uint256 sharesOut)
    {
        if (state != MarketState.TRADING) revert MarketNotTrading();
        if (block.timestamp >= closeTime) revert TradingClosed();
        if (usdcAmount == 0) revert ZeroAmount();

        // Transfer USDC from user
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        // Extract 1% protocol fee (not added to curve, so does not warp price)
        uint256 fee = usdcAmount * FEE_BPS / BPS;
        uint256 amountAfterFee = usdcAmount - fee;
        protocolFeesCollected += fee;

        // Compute shares via CPMM
        if (yesSide) {
            sharesOut = CPMM.getBuyOutput(reserveNo, reserveYes, amountAfterFee);
            reserveNo += amountAfterFee;
            reserveYes -= sharesOut;
            sharesYes[msg.sender] += sharesOut;
            totalShareYes += sharesOut;
            depositsYes[msg.sender] += usdcAmount;
        } else {
            sharesOut = CPMM.getBuyOutput(reserveYes, reserveNo, amountAfterFee);
            reserveYes += amountAfterFee;
            reserveNo -= sharesOut;
            sharesNo[msg.sender] += sharesOut;
            totalShareNo += sharesOut;
            depositsNo[msg.sender] += usdcAmount;
        }

        if (sharesOut < minSharesOut) revert SlippageExceeded();

        emit SharesBought(msg.sender, yesSide, usdcAmount, sharesOut);
    }

    /// @notice Sell YES or NO shares back for USDC.
    /// @param yesSide True to sell YES shares, false for NO.
    /// @param shareAmount Number of shares to sell.
    /// @param minUsdcOut Minimum USDC to receive (slippage protection).
    /// @return usdcOut Actual USDC received.
    function sell(bool yesSide, uint256 shareAmount, uint256 minUsdcOut)
        external
        nonReentrant
        whenNotPaused
        onlyInitialized
        returns (uint256 usdcOut)
    {
        if (state != MarketState.TRADING) revert MarketNotTrading();
        if (shareAmount == 0) revert ZeroAmount();

        uint256 grossOut;
        if (yesSide) {
            if (sharesYes[msg.sender] < shareAmount) revert InsufficientShares();
            grossOut = CPMM.getSellOutput(reserveYes, reserveNo, shareAmount);
            reserveYes += shareAmount;
            reserveNo -= grossOut;
            sharesYes[msg.sender] -= shareAmount;
            totalShareYes -= shareAmount;
        } else {
            if (sharesNo[msg.sender] < shareAmount) revert InsufficientShares();
            grossOut = CPMM.getSellOutput(reserveNo, reserveYes, shareAmount);
            reserveNo += shareAmount;
            reserveYes -= grossOut;
            sharesNo[msg.sender] -= shareAmount;
            totalShareNo -= shareAmount;
        }

        // 1% fee on output
        uint256 fee = grossOut * FEE_BPS / BPS;
        usdcOut = grossOut - fee;
        protocolFeesCollected += fee;

        if (usdcOut < minUsdcOut) revert SlippageExceeded();

        usdc.safeTransfer(msg.sender, usdcOut);
        emit SharesSold(msg.sender, yesSide, shareAmount, usdcOut);
    }

    // -- Settlement --

    /// @notice Request settlement after trading window closes. Anyone can call.
    /// @dev Transitions state from TRADING to PENDING_SETTLEMENT.
    function requestSettlement() external onlyInitialized {
        if (state != MarketState.TRADING) revert MarketNotTrading();
        if (block.timestamp < closeTime) revert TradingNotClosed();
        state = MarketState.PENDING_SETTLEMENT;
        emit SettlementRequested(marketId, closeTime);
    }

    /// @notice Oracle submits settlement values with a signed attestation.
    /// @param valueA Attention metric value for keyword A.
    /// @param valueB Attention metric value for keyword B (zero for DIRECTION markets).
    /// @param signature ECDSA signature from the authorized oracle signer.
    function submitSettlement(uint256 valueA, uint256 valueB, bytes calldata signature)
        external
        onlyInitialized
    {
        if (state != MarketState.PENDING_SETTLEMENT) revert MarketNotPendingSettlement();

        // Verify oracle signature
        bytes32 digest = keccak256(
            abi.encode(marketId, valueA, valueB, address(this), block.chainid)
        );
        bytes32 ethSignedHash = digest.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(signature);
        if (recovered != oracleSigner) revert InvalidSignature();

        // Determine winner
        if (marketType == MarketType.HEAD_TO_HEAD) {
            yesWon = valueA > valueB;
        } else {
            yesWon = valueA > threshold;
        }

        settlementValueA = valueA;
        settlementValueB = valueB;
        state = MarketState.SETTLED;

        // Transfer protocol fees to treasury
        if (protocolFeesCollected > 0) {
            usdc.safeTransfer(treasury, protocolFeesCollected);
        }

        emit Settled(marketId, yesWon, valueA, valueB);
    }

    // -- Claims --

    /// @notice Claim USDC payout after settlement.
    /// @dev Winners receive pro-rata share of the total pool (minus already-extracted fees).
    function claim() external nonReentrant onlyInitialized {
        if (state == MarketState.DISPUTED) {
            _claimRefund();
            return;
        }
        if (state != MarketState.SETTLED) revert MarketNotSettled();
        if (claimed[msg.sender]) revert NothingToClaim();

        uint256 userWinShares = yesWon ? sharesYes[msg.sender] : sharesNo[msg.sender];
        if (userWinShares == 0) revert NothingToClaim();

        claimed[msg.sender] = true;

        // Total pool is reserveYes + reserveNo (fees already removed to treasury)
        uint256 totalPool = reserveYes + reserveNo;
        uint256 winTotalShares = yesWon ? totalShareYes : totalShareNo;

        uint256 payout = (userWinShares * totalPool) / winTotalShares;

        usdc.safeTransfer(msg.sender, payout);
        emit Claimed(msg.sender, payout);
    }

    /// @notice Internal refund logic for DISPUTED state.
    function _claimRefund() internal {
        if (claimed[msg.sender]) revert NothingToClaim();
        uint256 deposit = depositsYes[msg.sender] + depositsNo[msg.sender];
        if (deposit == 0) revert NothingToClaim();
        claimed[msg.sender] = true;

        // Pro-rata refund: user gets (deposit / totalDeposits) * availableBalance
        // This handles cases where fees were partially extracted
        uint256 available = usdc.balanceOf(address(this));
        uint256 totalDeposits = _totalDeposits();
        uint256 payout = totalDeposits > 0 ? (deposit * available) / totalDeposits : 0;

        if (payout > 0) {
            usdc.safeTransfer(msg.sender, payout);
        }
        emit Claimed(msg.sender, payout);
    }

    /// @notice Placeholder for total deposits tracking (sum of all user deposits).
    /// @dev In practice, totalDeposits = reserveYes + reserveNo + protocolFeesCollected for pre-settlement.
    function _totalDeposits() internal view returns (uint256) {
        return reserveYes + reserveNo + protocolFeesCollected;
    }

    // -- Dispute --

    /// @notice Dispute the market if oracle fails to submit settlement within deadline + grace period.
    /// @dev Anyone can call. Transitions to DISPUTED, enabling pro-rata refunds for all participants.
    function dispute() external onlyInitialized {
        if (state != MarketState.PENDING_SETTLEMENT) revert MarketNotPendingSettlement();
        if (block.timestamp <= settlementDeadline + DISPUTE_GRACE) revert DisputeTooEarly();
        state = MarketState.DISPUTED;
        emit Disputed(marketId);
    }

    // -- Admin --

    /// @notice Pause trading (buy/sell). Does not affect claim or dispute.
    function emergencyPause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause trading.
    function unpause() external onlyOwner {
        _unpause();
    }

    // -- View Functions --

    /// @notice Get the user's position in this market.
    /// @param user Address to query.
    /// @return yesShares Number of YES shares held.
    /// @return noShares Number of NO shares held.
    /// @return yesDeposit Total USDC deposited into YES.
    /// @return noDeposit Total USDC deposited into NO.
    function getUserPosition(address user)
        external
        view
        returns (uint256 yesShares, uint256 noShares, uint256 yesDeposit, uint256 noDeposit)
    {
        return (sharesYes[user], sharesNo[user], depositsYes[user], depositsNo[user]);
    }

    /// @notice Preview the output of a buy operation.
    /// @param yesSide True for YES, false for NO.
    /// @param usdcAmount USDC input amount.
    /// @return sharesOut Expected shares output after fee.
    function previewBuy(bool yesSide, uint256 usdcAmount) external view returns (uint256 sharesOut) {
        uint256 amountAfterFee = usdcAmount - (usdcAmount * FEE_BPS / BPS);
        if (yesSide) {
            sharesOut = CPMM.getBuyOutput(reserveNo, reserveYes, amountAfterFee);
        } else {
            sharesOut = CPMM.getBuyOutput(reserveYes, reserveNo, amountAfterFee);
        }
    }

    /// @notice Preview the output of a sell operation.
    /// @param yesSide True for YES, false for NO.
    /// @param shareAmount Shares to sell.
    /// @return usdcOut Expected USDC output after fee.
    function previewSell(bool yesSide, uint256 shareAmount) external view returns (uint256 usdcOut) {
        uint256 grossOut;
        if (yesSide) {
            grossOut = CPMM.getSellOutput(reserveYes, reserveNo, shareAmount);
        } else {
            grossOut = CPMM.getSellOutput(reserveNo, reserveYes, shareAmount);
        }
        usdcOut = grossOut - (grossOut * FEE_BPS / BPS);
    }

    /// @notice Get current market state as a single enum value.
    /// @return Current MarketState.
    function getState() external view returns (MarketState) {
        return state;
    }
}
