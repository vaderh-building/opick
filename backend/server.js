import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import createMarketsRouter from "./routes/markets.js";
import commentsRouter from "./routes/comments.js";
import usersRouter from "./routes/users.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Config ----------
function loadConfig() {
  let factoryAddress = process.env.FACTORY_ADDRESS || "";
  let usdcAddress = process.env.USDC_ADDRESS || "";
  let rpcUrl = process.env.RPC_URL || "";

  if (!factoryAddress || !usdcAddress) {
    try {
      // Try mainnet first, then sepolia
      const files = [
        path.join(__dirname, "deployed-addresses-base-mainnet.json"),
        path.join(__dirname, "..", "deployed-addresses-base-mainnet.json"),
        path.join(__dirname, "deployed-addresses-base-sepolia.json"),
        path.join(__dirname, "..", "deployed-addresses-base-sepolia.json"),
      ];
      const p = files.find(f => fs.existsSync(f));
      if (p) {
        const a = JSON.parse(fs.readFileSync(p, "utf-8"));
        factoryAddress = factoryAddress || a.OPickFactory || "";
        usdcAddress = usdcAddress || a.USDC || a.MockUSDC || "";
      }
    } catch {}
  }

  rpcUrl = rpcUrl || "https://mainnet.base.org";
  return { factoryAddress, usdcAddress, rpcUrl };
}

const config = loadConfig();
console.log("Config:", config);

// ---------- Provider ----------
// Detect chain from config
const chainId = config.rpcUrl.includes('sepolia') ? 84532 : 8453;
const chainName = chainId === 8453 ? 'base' : 'base-sepolia';
const provider = new ethers.JsonRpcProvider(
  config.rpcUrl,
  { chainId, name: chainName },
  { staticNetwork: true }
);
console.log("Provider: chainId=%d name=%s rpc=%s", chainId, chainName, config.rpcUrl);

// ---------- ABIs ----------
function loadAbi(name) {
  for (const loc of [
    path.join(__dirname, "abi", `${name}.json`),
    path.join(__dirname, "..", "abi", `${name}.json`),
    path.join(__dirname, "..", "artifacts", "contracts", `${name}.sol`, `${name}.json`),
  ]) {
    if (fs.existsSync(loc)) {
      const c = JSON.parse(fs.readFileSync(loc, "utf-8"));
      return c.abi || c;
    }
  }
  throw new Error(`ABI not found: ${name}`);
}

const factoryAbi = loadAbi("OPickFactory");
const marketAbi = loadAbi("OPickMarket");
const factoryAddress = config.factoryAddress;

// ==========================================================================
// Market Cache — permanent, background-refreshed
// ==========================================================================

// Static data (never changes): topic, sideAName, sideBName, category, creator, createdAt
// Dynamic data (changes on trades): priceA, priceB, totalVolume, creatorEarnings, reserves, shares
const staticCache = new Map(); // address -> { topic, sideAName, sideBName, category, creator, createdAt }

const cache = {
  markets: null,
  loading: true,
  refresh: null, // set below
};

// Price history: { [address]: [{ timestamp, priceA, priceB }] }
const priceHistory = new Map();
const MAX_HISTORY = 500;

// Trade log: { [address]: [{ timestamp, side, amount, priceA, priceB }] }
const tradeLogs = new Map();
const MAX_TRADES = 100;

// Track previous volumes to detect new trades
const prevVolumes = new Map();

function recordPrices(markets) {
  if (!markets) return;
  const ts = Date.now();
  for (const m of markets) {
    if (!m.priceA) continue;
    // Price history
    const arr = priceHistory.get(m.address) || [];
    arr.push({ timestamp: ts, priceA: m.priceA, priceB: m.priceB });
    if (arr.length > MAX_HISTORY) arr.shift();
    priceHistory.set(m.address, arr);

    // Detect volume change = new trade
    const prevVol = prevVolumes.get(m.address) || "0";
    if (m.totalVolume !== prevVol && prevVol !== "0") {
      const delta = (Number(m.totalVolume) - Number(prevVol)) / 1e6;
      if (delta > 0) {
        const log = tradeLogs.get(m.address) || [];
        log.push({ timestamp: ts, amount: delta, priceA: m.priceA, priceB: m.priceB });
        if (log.length > MAX_TRADES) log.shift();
        tradeLogs.set(m.address, log);
      }
    }
    prevVolumes.set(m.address, m.totalVolume);
  }
}

// Timeout wrapper for any promise
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// Fetch market data with batched calls (4 rounds instead of 14 sequential)
async function fetchMarketData(addr) {
  const c = new ethers.Contract(addr, marketAbi, provider);

  // Static data (cached permanently)
  let stat;
  if (staticCache.has(addr)) {
    stat = staticCache.get(addr);
  } else {
    const [topic, sideAName, sideBName] = await withTimeout(
      Promise.all([c.topic(), c.sideAName(), c.sideBName()]), 8000
    );
    const [category, creator, createdAt] = await withTimeout(
      Promise.all([c.category(), c.creator(), c.createdAt()]), 8000
    );
    stat = { topic, sideAName, sideBName, category, creator, createdAt: createdAt.toString() };
    staticCache.set(addr, stat);
  }

  // Dynamic data in 2 batches
  const [priceA, priceB, totalVolume, creatorEarnings] = await withTimeout(
    Promise.all([c.priceA(), c.priceB(), c.totalVolume(), c.creatorEarnings()]), 8000
  );
  const [reserveA, reserveB, totalSharesA, totalSharesB] = await withTimeout(
    Promise.all([c.reserveA(), c.reserveB(), c.totalSharesA(), c.totalSharesB()]), 8000
  );

  return {
    address: addr, ...stat,
    priceA: priceA.toString(), priceB: priceB.toString(),
    totalVolume: totalVolume.toString(), creatorEarnings: creatorEarnings.toString(),
    reserveA: reserveA.toString(), reserveB: reserveB.toString(),
    totalSharesA: totalSharesA.toString(), totalSharesB: totalSharesB.toString(),
  };
}

async function fetchMarketWithRetry(addr) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await fetchMarketData(addr);
    } catch (err) {
      console.error(`  ${addr.slice(0,10)} attempt ${attempt}/2: ${err.message.slice(0, 60)}`);
      if (attempt < 2) await sleep(1000);
    }
  }
  // Fallback: return placeholder with static data if available
  if (staticCache.has(addr)) {
    return {
      address: addr, ...staticCache.get(addr),
      priceA: "500000000000000000", priceB: "500000000000000000",
      totalVolume: "0", creatorEarnings: "0",
      reserveA: "10000000000", reserveB: "10000000000",
      totalSharesA: "0", totalSharesB: "0",
    };
  }
  return null;
}

async function loadAllMarkets() {
  if (!factoryAddress) { console.log("No factoryAddress"); return []; }
  console.log("Loading markets from", factoryAddress);
  const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
  const total = Number(await withTimeout(factory.totalMarkets(), 10000));
  console.log("Factory:", total, "markets");
  if (total === 0) return [];

  const addresses = Array.from(await withTimeout(factory.getMarkets(0, total), 10000));
  const results = [];

  for (let i = 0; i < addresses.length; i++) {
    const m = await fetchMarketWithRetry(addresses[i]);
    if (m) results.push(m);
    console.log(`  ${i + 1}/${addresses.length} ${m ? "ok" : "SKIP"}`);
    if (i < addresses.length - 1) await sleep(200);
  }
  return results;
}

// Background refresh
async function backgroundRefresh() {
  if (!cache.markets || cache.markets.length === 0) {
    try { await withTimeout(cache.refresh(), 45000); } catch {}
    return;
  }
  try {
    const updated = [];
    for (const m of cache.markets) {
      try {
        const fresh = await withTimeout(fetchMarketData(m.address), 15000);
        updated.push(fresh);
      } catch {
        updated.push(m);
      }
      await sleep(200);
    }
    cache.markets = updated;
    recordPrices(updated);
  } catch {}
}

cache.refresh = async () => {
  console.log("Cache refresh triggered...");
  try {
    const markets = await withTimeout(loadAllMarkets(), 45000);
    cache.markets = markets;
    console.log("Cache refresh done:", markets.length, "markets");
    recordPrices(markets);
  } catch (e) {
    console.error("Cache refresh FAILED:", e.message);
    if (!cache.markets) cache.markets = [];
  }
};

// ---------- Express ----------
const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

app.use("/api/markets", createMarketsRouter({ provider, factoryAddress, factoryAbi, marketAbi, cache, priceHistory, tradeLogs }));
app.use("/api/comments", commentsRouter);
app.use("/api/users", usersRouter);

app.get("/api/health", async (req, res) => {
  const result = {
    status: cache.markets?.length > 0 ? "ok" : "no_markets",
    cachedMarkets: cache.markets?.length || 0,
    loading: cache.loading,
    rpcUrl: config.rpcUrl,
    chainId,
    factoryAddress,
  };
  // Live check
  try {
    const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
    result.onChainMarkets = Number(await factory.totalMarkets());
  } catch (e) {
    result.onChainError = e.message.slice(0, 100);
  }
  res.json(result);
});

// ---------- WebSocket ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  // Send current cache immediately on connect
  if (cache.markets) {
    const data = {};
    for (const m of cache.markets) {
      data[m.address] = { priceA: m.priceA, priceB: m.priceB };
    }
    ws.send(JSON.stringify({ type: "prices", data }));
  }
  ws.on("close", () => {});
});

// ---------- Start ----------
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`OPick backend on http://localhost:${PORT}`);

  // Non-blocking preload with 60s safety timeout
  cache.loading = true;

  const preload = async () => {
    try {
      const markets = await loadAllMarkets();
      cache.markets = markets;
      console.log(`Ready: ${markets.length} markets cached`);
    } catch (e) {
      console.error("Preload failed:", e.message);
      if (!cache.markets) cache.markets = [];
    } finally {
      cache.loading = false;
    }
  };

  // Start preload in background (server responds to requests immediately)
  preload();

  // Safety: force loading=false after 60s no matter what
  setTimeout(() => {
    if (cache.loading) {
      console.log("Safety timeout: forcing loading=false");
      cache.loading = false;
      if (!cache.markets) cache.markets = [];
    }
  }, 60000);

  // Background refresh every 60 seconds
  setInterval(backgroundRefresh, 60 * 1000);
});
