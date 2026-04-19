// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract OPickV6Market is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum State { OPEN, CLOSED_RESOLVED, CLOSED_REFUNDED }

    IERC20 public immutable usdc;
    address public immutable creator;
    address public immutable treasury;
    string public topic;
    string public sideAName;
    string public sideBName;
    string public category;
    uint256 public immutable volumeCap;
    uint256 public immutable createdAt;
    uint256 public constant DURATION = 30 days;
    uint256 public constant FEE_BPS = 300; // 3% total
    uint256 public constant BPS = 10000;

    State public state;
    bool public winningSide; // true = A, false = B (only meaningful when CLOSED_RESOLVED)

    // Deposits per user per side
    mapping(address => uint256) public depositsA;
    mapping(address => uint256) public depositsB;
    uint256 public totalA;
    uint256 public totalB;
    uint256 public totalVolume;

    // Amplifier (referrer) fee tracking per market
    // Each bet can have a different referrer, so track per-referrer
    mapping(address => uint256) public amplifierEarnings;
    uint256 public totalAmplifierFees;

    // Per-bet referrer tracking for fee calculation
    mapping(address => uint256) public userBetAmountA;
    mapping(address => uint256) public userBetAmountB;

    // Fee accumulators (pending until resolution)
    uint256 public pendingPlatformFee;
    uint256 public pendingCreatorFee;

    mapping(address => bool) public claimed;
    bool public amplifierFeesClaimed; // tracks if platform has swept unclaimed amplifier fees

    event BetPlaced(address indexed bettor, bool indexed side, uint256 usdcAmount, uint256 shares, address referrer);
    event MarketClosed(string reason);
    event Claimed(address indexed user, uint256 amount);
    event AmplifierClaimed(address indexed amplifier, uint256 amount);

    constructor(
        address _usdc, address _creator, address _treasury,
        string memory _topic, string memory _sideA, string memory _sideB,
        string memory _category, uint256 _volumeCap
    ) {
        usdc = IERC20(_usdc);
        creator = _creator;
        treasury = _treasury;
        topic = _topic;
        sideAName = _sideA;
        sideBName = _sideB;
        category = _category;
        volumeCap = _volumeCap;
        createdAt = block.timestamp;
        state = State.OPEN;
    }

    function totalPool() public view returns (uint256) { return totalA + totalB; }

    function buy(bool isSideA, uint256 amount, address referrer) external nonReentrant {
        require(state == State.OPEN, "Market not open");
        require(amount > 0, "Amount must be positive");
        uint256 pool = totalPool();
        require(pool + amount <= volumeCap, "Exceeds volume cap");

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Calculate pending fees (not deducted now, applied at resolution)
        uint256 fee = amount * FEE_BPS / BPS; // 3% of bet
        uint256 platformFee = fee / 3;          // 1%
        uint256 creatorFee = fee / 3;           // 1%
        uint256 amplifierFee = fee - platformFee - creatorFee; // 1% (absorbs rounding)

        pendingPlatformFee += platformFee;
        pendingCreatorFee += creatorFee;

        if (referrer != address(0) && referrer != msg.sender) {
            amplifierEarnings[referrer] += amplifierFee;
            totalAmplifierFees += amplifierFee;
        } else {
            // No referrer: amplifier fee goes to platform
            pendingPlatformFee += amplifierFee;
        }

        // Record deposit (full amount, fees deducted at resolution)
        if (isSideA) {
            depositsA[msg.sender] += amount;
            totalA += amount;
        } else {
            depositsB[msg.sender] += amount;
            totalB += amount;
        }
        totalVolume += amount;

        // Shares = deposit amount (1:1 in V6, no AMM pricing)
        emit BetPlaced(msg.sender, isSideA, amount, amount, referrer);

        // Auto-resolve if cap reached
        if (totalPool() >= volumeCap) {
            _resolve();
        }
    }

    function close() external {
        require(msg.sender == creator, "Only creator");
        require(state == State.OPEN, "Market not open");
        state = State.CLOSED_REFUNDED;
        // Clear pending fees on refund
        pendingPlatformFee = 0;
        pendingCreatorFee = 0;
        totalAmplifierFees = 0;
        emit MarketClosed("creator_closed");
    }

    function checkAndResolve() external {
        require(state == State.OPEN, "Market not open");
        if (totalPool() >= volumeCap) {
            _resolve();
            return;
        }
        require(block.timestamp >= createdAt + DURATION, "Not expired");
        state = State.CLOSED_REFUNDED;
        // Clear pending fees on refund
        pendingPlatformFee = 0;
        pendingCreatorFee = 0;
        totalAmplifierFees = 0;
        emit MarketClosed("expired_refund");
    }

    function _resolve() internal {
        require(state == State.OPEN, "Already closed");
        // Tie or one side empty: refund
        if (totalA == totalB || totalA == 0 || totalB == 0) {
            state = State.CLOSED_REFUNDED;
            pendingPlatformFee = 0;
            pendingCreatorFee = 0;
            totalAmplifierFees = 0;
            emit MarketClosed("refund_tie_or_empty");
            return;
        }
        winningSide = totalA > totalB;
        state = State.CLOSED_RESOLVED;

        // Transfer platform and creator fees immediately
        if (pendingPlatformFee > 0) {
            usdc.safeTransfer(treasury, pendingPlatformFee);
        }
        if (pendingCreatorFee > 0) {
            usdc.safeTransfer(creator, pendingCreatorFee);
        }
        emit MarketClosed("resolved");
    }

    function claim() external nonReentrant {
        require(state != State.OPEN, "Market still open");
        require(!claimed[msg.sender], "Already claimed");
        claimed[msg.sender] = true;

        uint256 payout;

        if (state == State.CLOSED_REFUNDED) {
            // Full refund of both sides
            payout = depositsA[msg.sender] + depositsB[msg.sender];
        } else {
            // CLOSED_RESOLVED: winners split losing pool
            uint256 userWinDeposit = winningSide ? depositsA[msg.sender] : depositsB[msg.sender];
            if (userWinDeposit > 0) {
                uint256 winTotal = winningSide ? totalA : totalB;
                // Pool after fees = total - platform - creator - amplifier fees
                uint256 feesDeducted = pendingPlatformFee + pendingCreatorFee + totalAmplifierFees;
                // Note: platform and creator fees already transferred in _resolve()
                // Amplifier fees held in contract for claimAmplifierFees()
                // Winner gets: original deposit + proportional share of (losing pool - losing side's share of fees)
                // Simplified: winner payout = (userWinDeposit / winTotal) * (totalPool - feesDeducted)
                uint256 poolAfterFees = totalA + totalB - feesDeducted;
                payout = (userWinDeposit * poolAfterFees) / winTotal;
            }

            // Losing side deposits are forfeited (distributed to winners)
        }

        require(payout > 0, "Nothing to claim");
        usdc.safeTransfer(msg.sender, payout);
        emit Claimed(msg.sender, payout);
    }

    function claimAmplifierFees() external nonReentrant {
        require(state == State.CLOSED_RESOLVED, "Not resolved");
        uint256 amount = amplifierEarnings[msg.sender];
        require(amount > 0, "No earnings");
        amplifierEarnings[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit AmplifierClaimed(msg.sender, amount);
    }

    function getClaimable(address user) external view returns (uint256) {
        if (state == State.OPEN || claimed[user]) return 0;
        if (state == State.CLOSED_REFUNDED) {
            return depositsA[user] + depositsB[user];
        }
        uint256 userWinDeposit = winningSide ? depositsA[user] : depositsB[user];
        if (userWinDeposit == 0) return 0;
        uint256 winTotal = winningSide ? totalA : totalB;
        uint256 feesDeducted = pendingPlatformFee + pendingCreatorFee + totalAmplifierFees;
        uint256 poolAfterFees = totalA + totalB - feesDeducted;
        return (userWinDeposit * poolAfterFees) / winTotal;
    }

    function timeRemaining() external view returns (uint256) {
        if (state != State.OPEN) return 0;
        uint256 deadline = createdAt + DURATION;
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }
}
