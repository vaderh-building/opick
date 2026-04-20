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

  // Markets hidden from the list (still accessible via direct URL)
  const HIDDEN_MARKETS = new Set([
    "0x1De15b5510B8D7Cdee42AA662949b85276663962",
  ].map(a => a.toLowerCase()));

  // GET /api/markets — always instant from cache (stale data during cold start)
  router.get("/", (req, res) => {
    const total = cache.markets?.length || 0;
    const loading = cache.loading;
    const stale = cache.isStale || false;
    if (stale) res.set("X-Cache-Stale", "true");
    if (total > 0) {
      const visible = cache.markets.filter(m => !HIDDEN_MARKETS.has(m.address.toLowerCase()));
      console.log(`[API] GET /markets returning ${visible.length} markets (stale: ${stale}, loading: ${loading})`);
      return res.json(visible);
    }
    console.log(`[API] GET /markets returning [] (stale: ${stale}, loading: ${loading})`);
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

  // GET /api/markets/:address — cache first, then on-chain fallback
  router.get("/:address", async (req, res) => {
    const addr = req.params.address.toLowerCase();

    // Check cache
    if (cache.markets) {
      const m = cache.markets.find((m) => m.address.toLowerCase() === addr);
      if (m) return res.json(m);
    }

    // Not in cache. Try reading from chain directly.
    try {
      const c = new ethers.Contract(req.params.address, marketAbi, provider);
      const topic = await c.topic();
      const sideAName = await c.sideAName();
      const sideBName = await c.sideBName();
      const category = await c.category();
      const creator = await c.creator();
      const createdAt = await c.createdAt();
      const priceA = await c.priceA();
      const priceB = await c.priceB();
      const totalVolume = await c.totalVolume();
      const creatorEarnings = await c.creatorEarnings();
      const reserveA = await c.reserveA();
      const reserveB = await c.reserveB();
      const totalSharesA = await c.totalSharesA();
      const totalSharesB = await c.totalSharesB();

      const market = {
        address: req.params.address, topic, sideAName, sideBName, category, creator,
        createdAt: createdAt.toString(),
        priceA: priceA.toString(), priceB: priceB.toString(),
        totalVolume: totalVolume.toString(), creatorEarnings: creatorEarnings.toString(),
        reserveA: reserveA.toString(), reserveB: reserveB.toString(),
        totalSharesA: totalSharesA.toString(), totalSharesB: totalSharesB.toString(),
      };

      // Add to cache for future requests
      if (cache.markets) {
        cache.markets.push(market);
      } else {
        cache.markets = [market];
      }

      return res.json(market);
    } catch (err) {
      res.status(404).json({ error: "Market not found", details: err.message });
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
      res.status(500).json({ error: "Failed to fetch positions", details: err.message });
    }
  });

  return router;
}
