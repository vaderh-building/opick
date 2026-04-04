import { Router } from "express";
import { ethers } from "ethers";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function createMarketsRouter({
  provider,
  factoryAddress,
  factoryAbi,
  marketAbi,
}) {
  const router = Router();

  let cachedMarkets = null;
  let cacheTimestamp = 0;
  const CACHE_TTL = 60_000; // 60 seconds

  async function fetchMarketData(marketAddress) {
    const contract = new ethers.Contract(marketAddress, marketAbi, provider);

    const [
      topic, sideAName, sideBName, category,
      priceA, priceB, totalVolume, creatorEarnings,
      reserveA, reserveB, totalSharesA, totalSharesB,
      creator, createdAt,
    ] = await Promise.all([
      contract.topic(), contract.sideAName(), contract.sideBName(), contract.category(),
      contract.priceA(), contract.priceB(), contract.totalVolume(), contract.creatorEarnings(),
      contract.reserveA(), contract.reserveB(), contract.totalSharesA(), contract.totalSharesB(),
      contract.creator(), contract.createdAt(),
    ]);

    return {
      address: marketAddress, topic, sideAName, sideBName, category,
      priceA: priceA.toString(), priceB: priceB.toString(),
      totalVolume: totalVolume.toString(), creatorEarnings: creatorEarnings.toString(),
      reserveA: reserveA.toString(), reserveB: reserveB.toString(),
      totalSharesA: totalSharesA.toString(), totalSharesB: totalSharesB.toString(),
      creator, createdAt: createdAt.toString(),
    };
  }

  async function fetchWithRetry(addr) {
    try {
      return await fetchMarketData(addr);
    } catch (err) {
      console.warn(`Retry market ${addr} after error: ${err.message}`);
      await sleep(2000);
      try {
        return await fetchMarketData(addr);
      } catch (err2) {
        console.error(`Failed market ${addr} on retry: ${err2.message}`);
        return null;
      }
    }
  }

  async function fetchAllMarkets(addresses) {
    const BATCH_SIZE = 2;
    const results = [];
    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      if (i > 0) await sleep(1000); // 1s between batches
      const batch = addresses.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(fetchWithRetry));
      results.push(...batchResults);
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchResults.filter(Boolean).length}/${batch.length} ok`);
    }
    return results.filter(Boolean);
  }

  // GET /api/markets
  router.get("/", async (req, res) => {
    try {
      const now = Date.now();
      if (cachedMarkets && now - cacheTimestamp < CACHE_TTL) {
        return res.json(cachedMarkets);
      }

      if (!factoryAddress) {
        console.warn("No factoryAddress configured");
        return res.json([]);
      }

      console.log("Fetching markets from factory:", factoryAddress);
      const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);

      const totalMarkets = await factory.totalMarkets();
      const count = Number(totalMarkets);
      console.log("Total markets on-chain:", count);

      if (count === 0) {
        cachedMarkets = [];
        cacheTimestamp = now;
        return res.json([]);
      }

      const marketAddresses = await factory.getMarkets(0, count);
      console.log("Loading", marketAddresses.length, "markets (batch=2, delay=1s)...");

      const markets = await fetchAllMarkets(Array.from(marketAddresses));
      console.log("Loaded", markets.length, "/", count, "markets");

      cachedMarkets = markets;
      cacheTimestamp = now;
      res.json(markets);
    } catch (err) {
      console.error("Failed to fetch markets:", err.message, err.code);
      // Return stale cache if available
      if (cachedMarkets) {
        console.log("Returning stale cache with", cachedMarkets.length, "markets");
        return res.json(cachedMarkets);
      }
      res.status(500).json({ error: "Failed to fetch markets", details: err.message });
    }
  });

  // GET /api/markets/:address
  router.get("/:address", async (req, res) => {
    try {
      const market = await fetchMarketData(req.params.address);
      res.json(market);
    } catch (err) {
      console.error("Failed to fetch market:", req.params.address, err.message);
      res.status(500).json({ error: "Failed to fetch market", details: err.message });
    }
  });

  // GET /api/markets/:address/positions/:userAddress
  router.get("/:address/positions/:userAddress", async (req, res) => {
    try {
      const contract = new ethers.Contract(req.params.address, marketAbi, provider);
      const [sharesA, sharesB] = await Promise.all([
        contract.sharesA(req.params.userAddress),
        contract.sharesB(req.params.userAddress),
      ]);
      res.json({ sharesA: sharesA.toString(), sharesB: sharesB.toString() });
    } catch (err) {
      console.error("Failed to fetch positions:", err.message);
      res.status(500).json({ error: "Failed to fetch positions", details: err.message });
    }
  });

  return router;
}
