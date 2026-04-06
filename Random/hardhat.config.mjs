import "@nomicfoundation/hardhat-toolbox";
export default {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    baseSepolia: { url: "https://sepolia.base.org", chainId: 84532 },
    localhost: { url: "http://127.0.0.1:8545", chainId: 31337 }
  }
};
