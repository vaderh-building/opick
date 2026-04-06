import { Router } from "express";
import { ethers } from "ethers";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function createMarketsRouter({
  provider,
  factoryAddress,
  factoryAbi,
  marketAbi,
  cache,
  priceHistory,
  tradeLogs,
}) {
  const router = Router();

  // GET /api/markets — always instant from cache
  router.get("/", (req, res) => {
    if (cache.markets && cache.markets.length > 0) {
      return res.json(cache.markets);
    }
    res.json([]);
  });

  // GET /api/markets/search?a=messi&b=ronaldo — BEFORE :address
  router.get("/search", (req, res) => {
    const a = (req.query.a || "").trim().toLowerCase();
    const b = (req.query.b || "").trim().toLowerCase();
    if (!a || !b || !cache.markets) return res.json([]);

    const matches = cache.markets.filter((m) => {
      const mA = (m.sideAName || "").toLowerCase();
      const mB = (m.sideBName || "").toLowerCase();
      return (mA === a && mB === b) || (mA === b && mB === a);
    });

    res.json(matches.map((m) => ({
      address: m.address, topic: m.topic,
      sideAName: m.sideAName, sideBName: m.sideBName,
      priceA: m.priceA, priceB: m.priceB,
      totalVolume: m.totalVolume, category: m.category,
    })));
  });

  // GET + POST /api/markets/refresh — BEFORE :address
  async function handleRefresh(req, res) {
    try {
      await cache.refresh();
      res.json({ success: true, markets: cache.markets?.length || 0 });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
  router.get("/refresh", handleRefresh);
  router.post("/refresh", handleRefresh);

  // GET /api/markets/trades/:address — recent trades
  router.get("/trades/:address", (req, res) => {
    const log = tradeLogs?.get(req.params.address) || [];
    res.json(log.slice(-20).reverse());
  });

  // POST /api/markets/trades/:address — record a trade from frontend
  router.post("/trades/:address", (req, res) => {
    const { side, amount, priceA, priceB } = req.body || {};
    if (!side || !amount) return res.json({ ok: false });
    const log = tradeLogs?.get(req.params.address) || [];
    log.push({ timestamp: Date.now(), side, amount: Number(amount), priceA, priceB });
    if (log.length > 100) log.shift();
    tradeLogs?.set(req.params.address, log);
    res.json({ ok: true });
  });

  // GET /api/markets/price-history/:address — BEFORE :address
  router.get("/price-history/:address", (req, res) => {
    const addr = req.params.address;
    const history = priceHistory?.get(addr) || [];
    res.json(history);
  });

  // GET /api/markets/:address — from cache (AFTER all specific routes)
  router.get("/:address", (req, res) => {
    const addr = req.params.address.toLowerCase();
    if (cache.markets) {
      const m = cache.markets.find((m) => m.address.toLowerCase() === addr);
      if (m) return res.json(m);
    }
    res.status(404).json({ error: "Market not found in cache" });
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
