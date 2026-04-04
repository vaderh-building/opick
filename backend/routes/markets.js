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
  const CACHE_TTL = 120_000; // 2 minutes

  // Track addresses that failed so we can retry them next time
  let failedAddresses = new Set();

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

  async function fetchWithRetry(addr, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fetchMarketData(addr);
      } catch (err) {
        if (attempt < maxRetries) {
          await sleep(1500 * attempt); // 1.5s, 3s, 4.5s
        } else {
          console.error(`Market ${addr} failed after ${maxRetries} attempts: ${err.message}`);
          return null;
        }
      }
    }
    return null;
  }

  async function fetchAllMarkets(addresses) {
    const BATCH_SIZE = 2;
    const results = [];
    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      if (i > 0) await sleep(1200);
      const batch = addresses.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map((a) => fetchWithRetry(a)));
      results.push(...batchResults);
      const ok = batchResults.filter(Boolean).length;
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${ok}/${batch.length}`);
    }

    const succeeded = results.filter(Boolean);
    const failed = addresses.filter((a, i) => !results[i]);
    failed.forEach((a) => failedAddresses.add(a));
    succeeded.forEach((m) => failedAddresses.delete(m.address));

    if (failed.length > 0) {
      console.warn(`${failed.length} markets failed, will retry next fetch`);
    }
    return succeeded;
  }

  // GET /api/markets
  router.get("/", async (req, res) => {
    try {
      const now = Date.now();

      // Serve cache if fresh
      if (cachedMarkets && now - cacheTimestamp < CACHE_TTL && failedAddresses.size === 0) {
        return res.json(cachedMarkets);
      }

      // If cache exists but some failed, try to fill gaps
      if (cachedMarkets && failedAddresses.size > 0 && now - cacheTimestamp < CACHE_TTL) {
        console.log(`Filling ${failedAddresses.size} missing markets...`);
        const missing = Array.from(failedAddresses);
        const filled = await fetchAllMarkets(missing);
        if (filled.length > 0) {
          const existingAddrs = new Set(cachedMarkets.map((m) => m.address));
          for (const m of filled) {
            if (!existingAddrs.has(m.address)) {
              cachedMarkets.push(m);
            }
          }
          cacheTimestamp = now;
        }
        return res.json(cachedMarkets);
      }

      if (!factoryAddress) return res.json([]);

      console.log("Full refresh from factory:", factoryAddress);
      const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
      const total = await factory.totalMarkets();
      const count = Number(total);
      console.log("Total on-chain:", count);

      if (count === 0) {
        cachedMarkets = [];
        cacheTimestamp = now;
        return res.json([]);
      }

      const marketAddresses = await factory.getMarkets(0, count);
      const markets = await fetchAllMarkets(Array.from(marketAddresses));
      console.log(`Loaded ${markets.length}/${count} markets`);

      cachedMarkets = markets;
      cacheTimestamp = now;
      res.json(markets);
    } catch (err) {
      console.error("Failed to fetch markets:", err.message);
      if (cachedMarkets) {
        console.log("Serving stale cache:", cachedMarkets.length, "markets");
        return res.json(cachedMarkets);
      }
      res.status(500).json({ error: "Failed to fetch markets", details: err.message });
    }
  });

  // GET /api/markets/:address — uses retry + fallback to cached data
  router.get("/:address", async (req, res) => {
    const addr = req.params.address;

    // Try cached data first
    if (cachedMarkets) {
      const cached = cachedMarkets.find((m) => m.address.toLowerCase() === addr.toLowerCase());
      if (cached) return res.json(cached);
    }

    // Fetch fresh with retry
    const market = await fetchWithRetry(addr);
    if (market) return res.json(market);

    res.status(500).json({ error: "Failed to fetch market", details: "All retries failed" });
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
      res.status(500).json({ error: "Failed to fetch positions", details: err.message });
    }
  });

  return router;
}
