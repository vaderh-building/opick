// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./OPickV6Market.sol";

contract OPickV6Factory is Ownable {
    IERC20 public immutable usdc;
    address public treasury;
    address[] public markets;
    mapping(address => bool) public isMarket;
    mapping(address => address[]) public creatorMarkets;

    event V6MarketCreated(
        address indexed market, address indexed creator,
        string topic, string sideA, string sideB, string category,
        uint256 volumeCap, uint256 index
    );

    constructor(address _usdc, address _treasury) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        treasury = _treasury;
    }

    function createMarket(
        string calldata _topic, string calldata _sideA, string calldata _sideB,
        string calldata _category, uint256 _volumeCap
    ) external returns (address addr) {
        require(_volumeCap > 0, "Cap must be positive");
        OPickV6Market m = new OPickV6Market(
            address(usdc), msg.sender, treasury,
            _topic, _sideA, _sideB, _category, _volumeCap
        );
        addr = address(m);
        markets.push(addr);
        isMarket[addr] = true;
        creatorMarkets[msg.sender].push(addr);
        emit V6MarketCreated(addr, msg.sender, _topic, _sideA, _sideB, _category, _volumeCap, markets.length - 1);
    }

    function totalMarkets() external view returns (uint256) { return markets.length; }

    function getMarkets(uint256 off, uint256 lim) external view returns (address[] memory r) {
        uint256 e = off + lim;
        if (e > markets.length) e = markets.length;
        r = new address[](e - off);
        for (uint256 i = off; i < e; i++) r[i - off] = markets[i];
    }

    function getCreatorMarkets(address c) external view returns (address[] memory) {
        return creatorMarkets[c];
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }
}
