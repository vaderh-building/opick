// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract OPickMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable usdc;
    address public immutable creator;
    string public topic;
    string public sideAName;
    string public sideBName;
    string public category;
    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public immutable k;
    mapping(address => uint256) public sharesA;
    mapping(address => uint256) public sharesB;
    uint256 public totalSharesA;
    uint256 public totalSharesB;
    uint256 public constant SPREAD_BPS = 50;
    uint256 public constant CREATOR_BPS = 3000;
    uint256 public constant PRECISION = 1e18;
    uint256 public totalVolume;
    uint256 public creatorEarnings;
    uint256 public createdAt;

    event Buy(address indexed user, bool indexed isSideA, uint256 usdcIn, uint256 sharesOut, uint256 priceAfter);
    event Sell(address indexed user, bool indexed isSideA, uint256 sharesIn, uint256 usdcOut, uint256 priceAfter);

    constructor(address _usdc, address _creator, string memory _topic, string memory _sideA, string memory _sideB, string memory _category, uint256 _initRes) {
        usdc = IERC20(_usdc); creator = _creator; topic = _topic; sideAName = _sideA; sideBName = _sideB; category = _category;
        reserveA = _initRes; reserveB = _initRes; k = _initRes * _initRes; createdAt = block.timestamp;
    }

    function priceA() public view returns (uint256) { return reserveB * PRECISION / (reserveA + reserveB); }
    function priceB() public view returns (uint256) { return reserveA * PRECISION / (reserveA + reserveB); }

    function buyA(uint256 amt) external nonReentrant returns (uint256 out) {
        require(amt > 0); usdc.safeTransferFrom(msg.sender, address(this), amt);
        uint256 nr = reserveB + amt; uint256 na = k / nr; out = reserveA - na;
        require(out > 0); reserveA = na; reserveB = nr;
        sharesA[msg.sender] += out; totalSharesA += out; totalVolume += amt;
        emit Buy(msg.sender, true, amt, out, priceA());
    }

    function buyB(uint256 amt) external nonReentrant returns (uint256 out) {
        require(amt > 0); usdc.safeTransferFrom(msg.sender, address(this), amt);
        uint256 na = reserveA + amt; uint256 nr = k / na; out = reserveB - nr;
        require(out > 0); reserveA = na; reserveB = nr;
        sharesB[msg.sender] += out; totalSharesB += out; totalVolume += amt;
        emit Buy(msg.sender, false, amt, out, priceA());
    }

    function sellA(uint256 shares) external nonReentrant returns (uint256 usdcOut) {
        require(shares > 0 && sharesA[msg.sender] >= shares);
        uint256 na = reserveA + shares; uint256 nr = k / na; uint256 gross = reserveB - nr;
        reserveA = na; reserveB = nr; sharesA[msg.sender] -= shares; totalSharesA -= shares;
        uint256 fee = gross * SPREAD_BPS / 10000; uint256 cf = fee * CREATOR_BPS / 10000;
        usdcOut = gross - fee; totalVolume += gross; creatorEarnings += cf;
        if (cf > 0) usdc.safeTransfer(creator, cf);
        usdc.safeTransfer(msg.sender, usdcOut);
        emit Sell(msg.sender, true, shares, usdcOut, priceA());
    }

    function sellB(uint256 shares) external nonReentrant returns (uint256 usdcOut) {
        require(shares > 0 && sharesB[msg.sender] >= shares);
        uint256 nr = reserveB + shares; uint256 na = k / nr; uint256 gross = reserveA - na;
        reserveA = na; reserveB = nr; sharesB[msg.sender] -= shares; totalSharesB -= shares;
        uint256 fee = gross * SPREAD_BPS / 10000; uint256 cf = fee * CREATOR_BPS / 10000;
        usdcOut = gross - fee; totalVolume += gross; creatorEarnings += cf;
        if (cf > 0) usdc.safeTransfer(creator, cf);
        usdc.safeTransfer(msg.sender, usdcOut);
        emit Sell(msg.sender, false, shares, usdcOut, priceA());
    }
}
