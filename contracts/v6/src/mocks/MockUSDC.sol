// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC - Test USDC token with open minting
/// @notice For testing only. Matches real USDC's 6 decimal places.
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) { return 6; }

    /// @notice Mint tokens to any address (testing only).
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
