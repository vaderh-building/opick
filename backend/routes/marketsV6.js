import { Router } from "express";
import { ethers } from "ethers";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function createMarketsV6Router({ provider, v6FactoryAddress, v6FactoryAbi, v6MarketAbi, v6Cache }) {
  const router = Router();

  // GET /api/v6/markets — list V6 markets
  router.get("/", (req, res) => {
    if (!v6Cache.markets || v6Cache.markets.length === 0) {
      return res.json({ markets: [] });
    }
    let markets = v6Cache.markets;
    // Filter by state
    const stateFilter = req.query.state;
    if (stateFilter) {
      const map = { open: 0, resolved: 1, refunded: 2 };
      const stateNum = map[stateFilter.toLowerCase()];
      if (stateNum !== undefined) {
        markets = markets.filter(m => m.stateNum === stateNum);
      }
    }
    // Filter by category
    if (req.query.category) {
      markets = markets.filter(m => m.category?.toLowerCase() === req.query.category.toLowerCase());
    }
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    res.json({ markets: markets.slice(0, limit) });
  });

  // GET /api/v6/markets/:address — single V6 market detail
  router.get("/:address", async (req, res) => {
    const addr = req.params.address.toLowerCase();

    // Check cache
    if (v6Cache.markets) {
      const m = v6Cache.markets.find(m => m.address.toLowerCase() === addr);
      if (m) return res.json(m);
    }

    // Fallback: read from chain
    try {
      const data = await fetchV6MarketData(req.params.address, provider, v6MarketAbi);
      if (data) {
        if (v6Cache.markets) v6Cache.markets.push(data);
        return res.json(data);
      }
    } catch (err) {
      return res.status(404).json({ error: "V6 market not found", details: err.message });
    }
    res.status(404).json({ error: "V6 market not found" });
  });

  // GET /api/v6/markets/:address/progress — lightweight polling
  router.get("/:address/progress", async (req, res) => {
    const addr = req.params.address.toLowerCase();
    let m = v6Cache.markets?.find(m => m.address.toLowerCase() === addr);

    if (!m) {
      try {
        m = await fetchV6MarketData(req.params.address, provider, v6MarketAbi);
      } catch {
        return res.status(404).json({ error: "V6 market not found" });
      }
    }

    if (!m) return res.status(404).json({ error: "V6 market not found" });

    res.json({
      pool_filled_usdc: m.current_pool_usdc,
      volume_cap_usdc: m.volume_cap_usdc,
      percentage: m.progress_percentage,
      side_a_usdc: m.side_a_usdc,
      side_b_usdc: m.side_b_usdc,
      seconds_remaining: m.seconds_until_expiry,
      state: m.state,
    });
  });

  // GET /api/v6/amplifier/:address/earnings
  router.get("/amplifier/:address/earnings", async (req, res) => {
    const wallet = req.params.address.toLowerCase();
    if (!v6Cache.markets) return res.json({ total_pending_usdc: 0, total_claimed_usdc: 0, markets: [] });

    const results = [];
    let totalPending = 0;

    for (const m of v6Cache.markets) {
      try {
        const contract = new ethers.Contract(m.address, v6MarketAbi, provider);
        const earnings = await contract.amplifierEarnings(wallet);
        const earningsNum = Number(earnings) / 1e6;
        if (earningsNum > 0) {
          results.push({
            market_id: m.address,
            market_topic: m.topic,
            referred_volume_usdc: earningsNum * 100, // approximate: 1% fee means volume = earnings * 100
            pending_fees_usdc: earningsNum,
            claimable: m.stateNum === 1, // CLOSED_RESOLVED
            claimed: false,
            market_state: m.state,
          });
          totalPending += earningsNum;
        }
      } catch {}
    }

    res.json({
      total_pending_usdc: Math.round(totalPending * 100) / 100,
      total_claimed_usdc: 0,
      markets: results,
    });
  });

  // POST /api/v6/markets/:address/ref-link
  router.post("/:address/ref-link", (req, res) => {
    const { address: refAddr } = req.body || {};
    if (!refAddr || !/^0x[a-fA-F0-9]{40}$/.test(refAddr)) {
      return res.status(400).json({ error: "Invalid address" });
    }
    const marketAddr = req.params.address;
    res.json({ url: `https://opick.io/v6/m/${marketAddr}?ref=${refAddr}` });
  });

  return router;
}

// Fetch V6 market data from chain
export async function fetchV6MarketData(addr, provider, v6MarketAbi) {
  const c = new ethers.Contract(addr, v6MarketAbi, provider);

  const [topic, sideAName, sideBName, category, creator, volumeCap, createdAt, state, totalA, totalB, totalVolume, timeRemaining] =
    await Promise.all([
      c.topic(), c.sideAName(), c.sideBName(), c.category(), c.creator(),
      c.volumeCap(), c.createdAt(), c.state(), c.totalA(), c.totalB(),
      c.totalVolume(), c.timeRemaining(),
    ]);

  const stateNum = Number(state);
  const stateNames = ["OPEN", "CLOSED_RESOLVED", "CLOSED_REFUNDED"];
  const capNum = Number(volumeCap) / 1e6;
  const poolNum = (Number(totalA) + Number(totalB)) / 1e6;

  let winningSide = null;
  if (stateNum === 1) {
    try { winningSide = await c.winningSide() ? "A" : "B"; } catch {}
  }

  return {
    address: addr,
    version: "v6",
    topic,
    sideA: sideAName,
    sideB: sideBName,
    sideAName,
    sideBName,
    category,
    creator,
    volume_cap_usdc: capNum,
    current_pool_usdc: Math.round(poolNum * 100) / 100,
    progress_percentage: capNum > 0 ? Math.round((poolNum / capNum) * 1000) / 10 : 0,
    side_a_usdc: Math.round(Number(totalA) / 1e6 * 100) / 100,
    side_b_usdc: Math.round(Number(totalB) / 1e6 * 100) / 100,
    totalA: totalA.toString(),
    totalB: totalB.toString(),
    totalVolume: totalVolume.toString(),
    state: stateNames[stateNum] || "UNKNOWN",
    stateNum,
    created_at: Number(createdAt),
    seconds_until_expiry: Number(timeRemaining),
    winner_side: winningSide,
  };
}
