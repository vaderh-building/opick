import hre from "hardhat";
import fs from "fs";
import path from "path";

const { ethers } = hre;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  const result = { chainId: 84532, deployer: deployer.address };

  // --- Step 1: Deploy MockUSDC ---
  console.log("Deploying MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();
  const usdcReceipt = await usdc.deploymentTransaction().wait();
  console.log("  MockUSDC:", usdcAddr);
  console.log("  Gas used:", usdcReceipt.gasUsed.toString());
  result.MockUSDC = usdcAddr;

  // Check remaining balance
  let bal = await ethers.provider.getBalance(deployer.address);
  console.log("  Balance remaining:", ethers.formatEther(bal), "ETH\n");

  await sleep(5000); // Wait for nonce to settle

  // --- Step 2: Deploy OPickFactory (treasury = deployer) ---
  console.log("Deploying OPickFactory...");
  console.log("  Treasury:", deployer.address);
  const Factory = await ethers.getContractFactory("OPickFactory");
  const factory = await Factory.deploy(usdcAddr, deployer.address);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  const factoryReceipt = await factory.deploymentTransaction().wait();
  console.log("  OPickFactory:", factoryAddr);
  console.log("  Gas used:", factoryReceipt.gasUsed.toString());
  result.OPickFactory = factoryAddr;

  bal = await ethers.provider.getBalance(deployer.address);
  console.log("  Balance remaining:", ethers.formatEther(bal), "ETH\n");

  await sleep(5000);

  // --- Step 3: Mint USDC to deployer for market creation fees ---
  console.log("Minting USDC to deployer...");
  const mintTx = await usdc.mint(deployer.address, 1000n * 10n ** 6n); // 1000 USDC
  const mintReceipt = await mintTx.wait();
  console.log("  Minted 1000 USDC. Gas used:", mintReceipt.gasUsed.toString());

  await sleep(5000);
  // Approve factory for creation fees
  const approveTx = await usdc.approve(factoryAddr, 1000n * 10n ** 6n);
  const approveReceipt = await approveTx.wait();
  console.log("  Approved factory. Gas used:", approveReceipt.gasUsed.toString());

  bal = await ethers.provider.getBalance(deployer.address);
  console.log("  Balance remaining:", ethers.formatEther(bal), "ETH\n");

  // --- Save addresses ---
  const outPath = path.resolve(process.cwd(), "deployed-addresses-base-sepolia.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log("Addresses saved to deployed-addresses-base-sepolia.json");

  // --- Update frontend config ---
  const configContent = `// Auto-generated — Base Sepolia deployment
export const CHAIN_ID = 84532;
export const RPC_URL = "https://sepolia.base.org";
export const USDC_ADDRESS = "${usdcAddr}";
export const FACTORY_ADDRESS = "${factoryAddr}";
export const DEPLOYER_ADDRESS = "${deployer.address}";
`;
  const configPath = path.resolve(process.cwd(), "frontend/src/config.js");
  fs.writeFileSync(configPath, configContent);
  console.log("Frontend config updated.\n");

  console.log("=== Core contracts deployed ===");
  console.log("  MockUSDC:     ", usdcAddr);
  console.log("  OPickFactory: ", factoryAddr);

  bal = await ethers.provider.getBalance(deployer.address);
  console.log("\nFinal balance:", ethers.formatEther(bal), "ETH");
  console.log("\nTo create markets, run: npx hardhat run scripts/create-markets-base-sepolia.mjs --network baseSepolia");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
