import hre from "hardhat";
import fs from "fs";
import path from "path";

const { ethers } = hre;

const MARKETS = [
  { topic: "Who is the football GOAT?", a: "Messi", b: "Ronaldo", cat: "Sports" },
  { topic: "Who is the basketball GOAT?", a: "LeBron", b: "Jordan", cat: "Sports" },
  { topic: "Is AI overhyped or underhyped?", a: "Bullish", b: "Bearish", cat: "Tech" },
  { topic: "Will Bitcoin hit $1M by 2030?", a: "Inevitable", b: "Never", cat: "Finance" },
  { topic: "Who is the better rapper?", a: "Kendrick", b: "Drake", cat: "Music" },
  { topic: "Is crypto the future?", a: "Bullish", b: "Bearish", cat: "Finance" },
  { topic: "Lakers vs Celtics — all time?", a: "Lakers", b: "Celtics", cat: "Sports" },
  { topic: "Real Madrid vs Barcelona?", a: "Madrid", b: "Barça", cat: "Sports" },
  { topic: "Elon Musk — visionary or fraud?", a: "Visionary", b: "Fraud", cat: "Culture" },
  { topic: "Tom Brady — GOAT?", a: "GOAT", b: "Not even top 3", cat: "Sports" },
  { topic: "Kanye West — genius or lost it?", a: "Musical genius", b: "Lost it", cat: "Music" },
  { topic: "Taylor Swift — genius or overrated?", a: "Genius", b: "Overrated", cat: "Music" },
  { topic: "Best streamer?", a: "Kai Cenat", b: "iShowSpeed", cat: "Tech" },
  { topic: "iPhone vs Android?", a: "iPhone", b: "Android", cat: "Tech" },
  { topic: "NYC vs LA?", a: "New York", b: "Los Angeles", cat: "Lifestyle" },
  { topic: "Cancel culture — justice or gone too far?", a: "Justice", b: "Gone too far", cat: "Culture" },
  { topic: "Cats vs Dogs?", a: "Cats", b: "Dogs", cat: "Lifestyle" },
  { topic: "Gold vs Bitcoin?", a: "Gold", b: "Bitcoin", cat: "Finance" },
  { topic: "GTA VI — will it be the GOAT?", a: "Will be GOAT", b: "Overhyped", cat: "Tech" },
  { topic: "Rihanna vs Beyoncé?", a: "Rihanna", b: "Beyoncé", cat: "Music" },
  { topic: "Is a college degree worth it?", a: "Worth it", b: "Waste of money", cat: "Culture" },
  { topic: "Kobe vs Duncan?", a: "Kobe", b: "Duncan", cat: "Sports" },
  { topic: "Tipping culture?", a: "Keep it", b: "Abolish it", cat: "Culture" },
  { topic: "Remote work — here to stay?", a: "Here to stay", b: "Going back", cat: "Culture" },
  { topic: "Nike vs Adidas?", a: "Nike", b: "Adidas", cat: "Lifestyle" },
  { topic: "BMW vs Mercedes?", a: "BMW", b: "Mercedes", cat: "Lifestyle" },
];

async function main() {
  // Load deployed addresses
  const addrPath = path.resolve(process.cwd(), "deployed-addresses-base-sepolia.json");
  if (!fs.existsSync(addrPath)) {
    console.error("Run deploy-base-sepolia.mjs first.");
    process.exit(1);
  }
  const addrs = JSON.parse(fs.readFileSync(addrPath, "utf-8"));

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  console.log("Factory:", addrs.OPickFactory);
  console.log("USDC:", addrs.MockUSDC, "\n");

  const usdc = await ethers.getContractAt("MockUSDC", addrs.MockUSDC);
  const factory = await ethers.getContractAt("OPickFactory", addrs.OPickFactory);

  // Check how many markets already exist
  const existing = Number(await factory.totalMarkets());
  console.log(`Existing markets: ${existing}`);
  const toCreate = MARKETS.slice(existing);
  if (toCreate.length === 0) {
    console.log("All 26 markets already created.");
    return;
  }
  console.log(`Creating ${toCreate.length} markets (starting from #${existing + 1})...\n`);

  // Ensure enough USDC balance and approval
  const needed = BigInt(toCreate.length) * 5n * 10n ** 6n;
  const usdcBal = await usdc.balanceOf(deployer.address);
  console.log(`USDC balance: ${Number(usdcBal) / 1e6}, needed: ${Number(needed) / 1e6}`);

  if (usdcBal < needed) {
    console.log("Minting more USDC...");
    const tx = await usdc.mint(deployer.address, needed - usdcBal + 10n * 10n ** 6n);
    await tx.wait();
    console.log("Minted.");
  }

  const allowance = await usdc.allowance(deployer.address, addrs.OPickFactory);
  if (allowance < needed) {
    console.log("Approving USDC...");
    const tx = await usdc.approve(addrs.OPickFactory, needed * 2n);
    await tx.wait();
    console.log("Approved.");
  }

  let totalGas = 0n;
  const marketAddresses = [];

  for (let i = 0; i < toCreate.length; i++) {
    const m = toCreate[i];
    const idx = existing + i + 1;

    let bal = await ethers.provider.getBalance(deployer.address);
    if (bal < ethers.parseEther("0.00001")) {
      console.log(`\n  Out of gas after ${i} markets. Remaining balance: ${ethers.formatEther(bal)} ETH`);
      console.log("  Fund the deployer and re-run this script to continue.");
      break;
    }

    try {
      // Wait for nonce to be clear before sending next tx
      if (i > 0) await new Promise(r => setTimeout(r, 3000));
      const tx = await factory.connect(deployer).createMarket(m.topic, m.a, m.b, m.cat);
      const receipt = await tx.wait();
      totalGas += receipt.gasUsed;

      let addr;
      for (const log of receipt.logs) {
        try {
          const parsed = factory.interface.parseLog({ topics: log.topics, data: log.data });
          if (parsed?.name === "MarketCreated") { addr = parsed.args.market; break; }
        } catch {}
      }

      marketAddresses.push(addr);
      console.log(`  [${String(idx).padStart(2)}] ${m.a} vs ${m.b} — ${addr} (gas: ${receipt.gasUsed})`);
    } catch (e) {
      console.error(`  [${String(idx).padStart(2)}] FAILED: ${e.message?.slice(0, 80)}`);
      console.log("  Stopping. Re-run to continue from here.");
      break;
    }
  }

  const finalBal = await ethers.provider.getBalance(deployer.address);
  console.log(`\nTotal gas used: ${totalGas}`);
  console.log(`Final balance: ${ethers.formatEther(finalBal)} ETH`);
  console.log(`Markets created this run: ${marketAddresses.length}`);
  console.log(`Total markets: ${existing + marketAddresses.length}`);

  // Update addresses file
  addrs.markets = [...(addrs.markets || []), ...marketAddresses];
  fs.writeFileSync(addrPath, JSON.stringify(addrs, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
