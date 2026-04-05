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

async function fetchStaticData(addr) {
  if (staticCache.has(addr)) return staticCache.get(addr);
  const c = new ethers.Contract(addr, marketAbi, provider);
  const [topic, sideAName, sideBName, category, creator, createdAt] = await Promise.all([
    c.topic(), c.sideAName(), c.sideBName(), c.category(), c.creator(), c.createdAt(),
  ]);
  const data = { topic, sideAName, sideBName, category, creator, createdAt: createdAt.toString() };
  staticCache.set(addr, data);
  return data;
}

async function fetchDynamicData(addr) {
  const c = new ethers.Contract(addr, marketAbi, provider);
  const [priceA, priceB, totalVolume, creatorEarnings, reserveA, reserveB, totalSharesA, totalSharesB] =
    await Promise.all([
      c.priceA(), c.priceB(), c.totalVolume(), c.creatorEarnings(),
      c.reserveA(), c.reserveB(), c.totalSharesA(), c.totalSharesB(),
    ]);
  return {
    priceA: priceA.toString(), priceB: priceB.toString(),
    totalVolume: totalVolume.toString(), creatorEarnings: creatorEarnings.toString(),
    reserveA: reserveA.toString(), reserveB: reserveB.toString(),
    totalSharesA: totalSharesA.toString(), totalSharesB: totalSharesB.toString(),
  };
}

async function fetchMarketWithRetry(addr, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const [stat, dyn] = await Promise.all([fetchStaticData(addr), fetchDynamicData(addr)]);
      return { address: addr, ...stat, ...dyn };
    } catch (err) {
      if (attempt < maxRetries) {
        await sleep(2000);
      } else {
        console.error(`  FAILED ${addr} after ${maxRetries} attempts: ${err.message}`);
        // Return static data with placeholder dynamic if we have it
        if (staticCache.has(addr)) {
          return {
            address: addr, ...staticCache.get(addr),
            priceA: "500000000000000000", priceB: "500000000000000000",
            totalVolume: "0", creatorEarnings: "0",
            reserveA: "1000000000", reserveB: "1000000000",
            totalSharesA: "0", totalSharesB: "0",
          };
        }
        return null;
      }
    }
  }
  return null;
}

async function loadAllMarkets() {
  if (!factoryAddress) return [];
  const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
  const total = Number(await factory.totalMarkets());
  if (total === 0) return [];

  const addresses = Array.from(await factory.getMarkets(0, total));
  console.log(`Loading ${addresses.length} markets...`);

  const results = [];
  // One at a time to be gentle on RPC
  for (let i = 0; i < addresses.length; i++) {
    const m = await fetchMarketWithRetry(addresses[i]);
    if (m) results.push(m);
    console.log(`  ${i + 1}/${addresses.length} ${m ? "ok" : "FAILED"}`);
    if (i < addresses.length - 1) await sleep(500);
  }
  return results;
}

// Background refresh — updates dynamic data only
async function backgroundRefresh() {
  if (!cache.markets || cache.markets.length === 0) return;
  console.log("Background refresh...");
  try {
    const updated = [];
    for (const m of cache.markets) {
      try {
        const dyn = await fetchDynamicData(m.address);
        updated.push({ ...m, ...dyn });
      } catch {
        updated.push(m); // Keep old data
      }
      await sleep(300);
    }
    cache.markets = updated;
    console.log(`Background refresh done: ${updated.length} markets`);
  } catch (e) {
    console.error("Background refresh failed:", e.message);
  }
}

cache.refresh = async () => {
  const markets = await loadAllMarkets();
  if (markets.length > 0) {
    cache.markets = markets;
  }
};

// ---------- Express ----------
const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

app.use("/api/markets", createMarketsRouter({ provider, factoryAddress, factoryAbi, marketAbi, cache }));
app.use("/api/comments", commentsRouter);
app.use("/api/users", usersRouter);

app.get("/api/health", (req, res) => {
  res.json({
    status: cache.markets ? "ok" : "loading",
    markets: cache.markets?.length || 0,
    loading: cache.loading,
    rpcUrl: config.rpcUrl,
    factoryAddress,
  });
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
server.listen(PORT, async () => {
  console.log(`OPick backend on http://localhost:${PORT}`);

  // Preload on startup — block until done
  console.log("Preloading all markets...");
  try {
    const markets = await loadAllMarkets();
    cache.markets = markets;
    cache.loading = false;
    console.log(`Ready: ${markets.length} markets cached`);
  } catch (e) {
    cache.loading = false;
    console.error("Preload failed:", e.message);
  }

  // Background refresh every 5 minutes
  setInterval(backgroundRefresh, 5 * 60 * 1000);
});
