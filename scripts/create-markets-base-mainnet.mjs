import hre from "hardhat";

const { ethers } = hre;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const FACTORY = "0x049131B36277322410f19039Af0c4e0E7Bc824CA";

const MARKETS = [
  { topic: "Who is the GOAT? Messi vs Ronaldo", a: "Messi", b: "Ronaldo", cat: "Sports" },
  { topic: "Who is the GOAT? LeBron vs Jordan", a: "LeBron", b: "Jordan", cat: "Sports" },
  { topic: "Who won the rap battle? Kendrick vs Drake", a: "Kendrick", b: "Drake", cat: "Music" },
  { topic: "Kanye West in 2026", a: "Still a genius", b: "Lost it", cat: "Music" },
  { topic: "Best mobile OS", a: "iPhone", b: "Android", cat: "Tech" },
  { topic: "AI in 2026", a: "Overhyped", b: "Underhyped", cat: "Tech" },
  { topic: "Bitcoin to $1M before 2030?", a: "Before 2030", b: "Never", cat: "Finance" },
  { topic: "Elon Musk", a: "Visionary", b: "Dangerous ego", cat: "Culture" },
  { topic: "Best city to live in?", a: "NYC", b: "LA", cat: "Lifestyle" },
  { topic: "Best pet?", a: "Cats", b: "Dogs", cat: "Lifestyle" },
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address);
  console.log("ETH balance:", ethers.formatEther(balance));
  console.log("Factory:", FACTORY);
  console.log("");

  const factory = await ethers.getContractAt("OPickFactory", FACTORY);
  const existing = Number(await factory.totalMarkets());
  console.log("Existing markets:", existing);

  const toCreate = MARKETS.slice(existing);
  if (toCreate.length === 0) {
    console.log("All 10 markets already created.");
    return;
  }
  console.log(`Creating ${toCreate.length} markets (starting from #${existing + 1})...\n`);

  const addresses = [];

  for (let i = 0; i < toCreate.length; i++) {
    const m = toCreate[i];
    const idx = existing + i + 1;

    if (i > 0) await sleep(3000);

    try {
      const tx = await factory.connect(deployer).createMarket(m.topic, m.a, m.b, m.cat);
      const receipt = await tx.wait();

      let addr;
      for (const log of receipt.logs) {
        try {
          const parsed = factory.interface.parseLog({ topics: log.topics, data: log.data });
          if (parsed?.name === "MarketCreated") { addr = parsed.args.market; break; }
        } catch {}
      }

      addresses.push(addr);
      console.log(`  [${idx}] ${m.a} vs ${m.b} => ${addr} (gas: ${receipt.gasUsed})`);
    } catch (e) {
      console.error(`  [${idx}] FAILED: ${e.message?.slice(0, 80)}`);
      console.log("  Stopping. Re-run to continue.");
      break;
    }
  }

  console.log(`\nCreated ${addresses.length} markets this run.`);
  console.log("Total markets:", existing + addresses.length);

  // Refresh backend cache
  console.log("\nRefreshing backend cache...");
  try {
    const res = await fetch("https://opick-production.up.railway.app/api/markets/refresh", { method: "POST" });
    const data = await res.json();
    console.log("Backend:", data);
  } catch (e) {
    console.log("Backend refresh failed:", e.message);
  }

  const finalBal = await ethers.provider.getBalance(deployer.address);
  console.log("\nFinal ETH balance:", ethers.formatEther(finalBal));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
