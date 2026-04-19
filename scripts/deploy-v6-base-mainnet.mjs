import hre from "hardhat";
import fs from "fs";
import path from "path";

const { ethers } = hre;

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TREASURY = "0xBc50b0C4c72928c7AE4702D39452BE4aF82e533d";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("=== OPick V6 Base Mainnet Deployment ===\n");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  console.log("USDC:", BASE_USDC);
  console.log("Treasury:", TREASURY);
  console.log("");

  console.log("Deploying OPickV6Factory...");
  const Factory = await ethers.getContractFactory("OPickV6Factory");
  const factory = await Factory.deploy(BASE_USDC, TREASURY);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  const receipt = await factory.deploymentTransaction().wait();
  console.log("  OPickV6Factory:", factoryAddr);
  console.log("  Gas used:", receipt.gasUsed.toString());

  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("  Balance remaining:", ethers.formatEther(bal), "ETH\n");

  // Save addresses
  const result = {
    chainId: 8453,
    network: "base-mainnet",
    deployer: deployer.address,
    treasury: TREASURY,
    USDC: BASE_USDC,
    OPickV6Factory: factoryAddr,
  };
  const outPath = path.resolve(process.cwd(), "deployed-addresses-v6-base-mainnet.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log("Saved to deployed-addresses-v6-base-mainnet.json");

  console.log("\n=== V6 Deployment complete ===");
  console.log("  OPickV6Factory:", factoryAddr);
  console.log("\nSet in Railway: V6_FACTORY_ADDRESS=" + factoryAddr);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
