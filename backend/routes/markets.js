import { Router } from "express";
import { ethers } from "ethers";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function createMarketsRouter({
  provider,
  factoryAddress,
  factoryAbi,
  marketAbi,
  cache, // shared cache object from server.js
}) {
  const router = Router();

  // GET /api/markets — always instant from cache
  router.get("/", (req, res) => {
    if (cache.markets && cache.markets.length > 0) {
      return res.json(cache.markets);
    }
    if (cache.loading) {
      return res.json([]); // Still loading on startup
    }
    res.json([]);
  });

  // GET /api/markets/search?a=messi&b=ronaldo
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
      address: m.address,
      topic: m.topic,
      sideAName: m.sideAName,
      sideBName: m.sideBName,
      priceA: m.priceA,
      priceB: m.priceB,
      totalVolume: m.totalVolume,
      category: m.category,
    })));
  });

  // GET /api/markets/:address — from cache
  router.get("/:address", (req, res) => {
    const addr = req.params.address.toLowerCase();
    if (cache.markets) {
      const m = cache.markets.find((m) => m.address.toLowerCase() === addr);
      if (m) return res.json(m);
    }
    res.status(404).json({ error: "Market not found in cache" });
  });

  // GET /api/markets/:address/positions/:userAddress — live RPC (small call)
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

  // POST /api/refresh-cache — manual trigger
  router.post("/refresh-cache", async (req, res) => {
    try {
      await cache.refresh();
      res.json({ ok: true, count: cache.markets?.length || 0 });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
