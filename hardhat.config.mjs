import "@nomicfoundation/hardhat-toolbox";
export default {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    base: {
      url: "https://mainnet.base.org",
      chainId: 8453,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    baseSepolia: { url: "https://sepolia.base.org", chainId: 84532 },
    localhost: { url: "http://127.0.0.1:8545", chainId: 31337 }
  }
};
