import hre from "hardhat";
import fs from "fs";
import path from "path";

const { ethers } = hre;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("=== OPick Base Mainnet Deployment ===\n");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  console.log("USDC (Base native):", BASE_USDC);
  console.log("Treasury:", deployer.address);
  console.log("");

  const result = {
    chainId: 8453,
    network: "base-mainnet",
    deployer: deployer.address,
    treasury: deployer.address,
    USDC: BASE_USDC,
  };

  // Deploy OPickFactory
  console.log("Deploying OPickFactory...");
  const Factory = await ethers.getContractFactory("OPickFactory");
  const factory = await Factory.deploy(BASE_USDC, deployer.address);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  const receipt = await factory.deploymentTransaction().wait();
  console.log("  OPickFactory:", factoryAddr);
  console.log("  Gas used:", receipt.gasUsed.toString());
  result.OPickFactory = factoryAddr;

  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("  Balance remaining:", ethers.formatEther(bal), "ETH\n");

  // Save addresses
  const outPath = path.resolve(process.cwd(), "deployed-addresses-base-mainnet.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log("Saved to deployed-addresses-base-mainnet.json");

  console.log("\n=== Deployment complete ===");
  console.log("  Network:       Base Mainnet (8453)");
  console.log("  OPickFactory:", factoryAddr);
  console.log("  USDC:         ", BASE_USDC);
  console.log("  Treasury:     ", deployer.address);
  console.log("\nTo create markets:");
  console.log("  npx hardhat run scripts/create-markets-base-mainnet.mjs --network base");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
