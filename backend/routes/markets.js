import { Router } from "express";
import { ethers } from "ethers";

export default function createMarketsRouter({
  provider,
  factoryAddress,
  factoryAbi,
  marketAbi,
}) {
  const router = Router();

  let cachedMarkets = null;
  let cacheTimestamp = 0;
  const CACHE_TTL = 5000;

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
      console.log("Fetched", marketAddresses.length, "market addresses, loading data...");

      const markets = await Promise.all(
        marketAddresses.map((addr) => fetchMarketData(addr))
      );

      cachedMarkets = markets;
      cacheTimestamp = now;
      res.json(markets);
    } catch (err) {
      console.error("Failed to fetch markets:", err.message, err.code, err);
      res.status(500).json({ error: "Failed to fetch markets", details: err.message });
    }
  });

  // GET /api/markets/:address
  router.get("/:address", async (req, res) => {
    try {
      const market = await fetchMarketData(req.params.address);
      res.json(market);
    } catch (err) {
      console.error("Failed to fetch market:", req.params.address, err.message, err.code);
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
      console.error("Failed to fetch positions:", err.message, err.code);
      res.status(500).json({ error: "Failed to fetch positions", details: err.message });
    }
  });

  return router;
}
