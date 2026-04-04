// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./OPickMarket.sol";

contract OPickFactory is Ownable {
    using SafeERC20 for IERC20;
    IERC20 public immutable usdc;
    uint256 public creationFee = 5e6;
    uint256 public constant INITIAL_RESERVE = 1000e6;
    address[] public markets;
    mapping(address => bool) public isMarket;
    mapping(address => address[]) public creatorMarkets;

    event MarketCreated(address indexed market, address indexed creator, string topic, string sideA, string sideB, string category, uint256 index);

    constructor(address _usdc) Ownable(msg.sender) { usdc = IERC20(_usdc); }

    function createMarket(string calldata _topic, string calldata _sideA, string calldata _sideB, string calldata _category) external returns (address addr) {
        if (creationFee > 0) usdc.safeTransferFrom(msg.sender, address(this), creationFee);
        OPickMarket m = new OPickMarket(address(usdc), msg.sender, _topic, _sideA, _sideB, _category, INITIAL_RESERVE);
        addr = address(m); markets.push(addr); isMarket[addr] = true; creatorMarkets[msg.sender].push(addr);
        emit MarketCreated(addr, msg.sender, _topic, _sideA, _sideB, _category, markets.length - 1);
    }

    function totalMarkets() external view returns (uint256) { return markets.length; }
    function getMarkets(uint256 off, uint256 lim) external view returns (address[] memory r) {
        uint256 e = off + lim; if (e > markets.length) e = markets.length;
        r = new address[](e - off); for (uint256 i = off; i < e; i++) r[i-off] = markets[i];
    }
    function getCreatorMarkets(address c) external view returns (address[] memory) { return creatorMarkets[c]; }
    function setCreationFee(uint256 f) external onlyOwner { creationFee = f; }
    function withdrawFees(address to) external onlyOwner { uint256 b = usdc.balanceOf(address(this)); if (b > 0) usdc.safeTransfer(to, b); }
}
