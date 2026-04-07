import hre from "hardhat";
import fs from "fs";
import path from "path";

const { ethers } = hre;

function readConfig() {
  const configPath = path.resolve(process.cwd(), "frontend/src/config.js");
  const src = fs.readFileSync(configPath, "utf-8");
  const usdcMatch = src.match(/USDC_ADDRESS\s*=\s*"([^"]+)"/);
  const factoryMatch = src.match(/FACTORY_ADDRESS\s*=\s*"([^"]+)"/);
  if (!usdcMatch || !factoryMatch) throw new Error("Run deploy-local first.");
  return { usdcAddress: usdcMatch[1], factoryAddress: factoryMatch[1] };
}

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
  const { usdcAddress, factoryAddress } = readConfig();
  const [deployer] = await ethers.getSigners();
  const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);
  const factory = await ethers.getContractAt("OPickFactory", factoryAddress);

  // Approve factory for creation fees (26 × $5)
  await (await usdc.connect(deployer).approve(factoryAddress, 26n * 5n * 10n ** 6n)).wait();

  console.log("Creating 26 markets...\n");

  for (let i = 0; i < MARKETS.length; i++) {
    const m = MARKETS[i];
    const tx = await factory.connect(deployer).createMarket(m.topic, m.a, m.b, m.cat);
    const receipt = await tx.wait();
    let addr;
    for (const log of receipt.logs) {
      try {
        const parsed = factory.interface.parseLog({ topics: log.topics, data: log.data });
        if (parsed?.name === "MarketCreated") { addr = parsed.args.market; break; }
      } catch {}
    }
    console.log(`  [${String(i + 1).padStart(2)}] ${m.a} vs ${m.b} — ${addr}`);
  }

  console.log(`\n${MARKETS.length} markets created. All at 50/50, $0 volume.`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
