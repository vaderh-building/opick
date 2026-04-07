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
import db from "./db.js";

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

// Fetch all market data sequentially (avoids RPC rate limits)
async function fetchMarketData(addr) {
  const c = new ethers.Contract(addr, marketAbi, provider);

  // Static data (cached permanently)
  let stat;
  if (staticCache.has(addr)) {
    stat = staticCache.get(addr);
  } else {
    const topic = await c.topic();
    const sideAName = await c.sideAName();
    const sideBName = await c.sideBName();
    const category = await c.category();
    const creator = await c.creator();
    const createdAt = await c.createdAt();
    stat = { topic, sideAName, sideBName, category, creator, createdAt: createdAt.toString() };
    staticCache.set(addr, stat);
  }

  // Dynamic data
  const priceA = await c.priceA();
  const priceB = await c.priceB();
  const totalVolume = await c.totalVolume();
  const creatorEarnings = await c.creatorEarnings();
  const reserveA = await c.reserveA();
  const reserveB = await c.reserveB();
  const totalSharesA = await c.totalSharesA();
  const totalSharesB = await c.totalSharesB();

  return {
    address: addr, ...stat,
    priceA: priceA.toString(), priceB: priceB.toString(),
    totalVolume: totalVolume.toString(), creatorEarnings: creatorEarnings.toString(),
    reserveA: reserveA.toString(), reserveB: reserveB.toString(),
    totalSharesA: totalSharesA.toString(), totalSharesB: totalSharesB.toString(),
  };
}

async function fetchMarketWithRetry(addr, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchMarketData(addr);
    } catch (err) {
      console.error(`  Market ${addr} attempt ${attempt}/${maxRetries}: ${err.message.slice(0, 100)}`);
      if (attempt < maxRetries) {
        await sleep(2000 * attempt);
      } else {
        if (staticCache.has(addr)) {
          console.log(`  Using cached static data for ${addr}`);
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
  if (!factoryAddress) { console.log("No factoryAddress, skipping market load"); return []; }
  console.log("Querying factory at", factoryAddress, "via", config.rpcUrl);
  const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
  const total = Number(await factory.totalMarkets());
  console.log("Factory reports", total, "markets");
  if (total === 0) return [];

  const addresses = Array.from(await factory.getMarkets(0, total));
  console.log(`Loading ${addresses.length} markets...`);

  const results = [];
  for (let i = 0; i < addresses.length; i++) {
    const m = await fetchMarketWithRetry(addresses[i]);
    if (m) results.push(m);
    console.log(`  ${i + 1}/${addresses.length} ${m ? "ok" : "FAILED"}`);
    if (i < addresses.length - 1) await sleep(500);
  }
  return results;
}

// Background refresh
async function backgroundRefresh() {
  if (!cache.markets || cache.markets.length === 0) {
    try { await cache.refresh(); } catch {}
    return;
  }
  console.log("Background refresh...");
  try {
    const updated = [];
    for (const m of cache.markets) {
      try {
        const fresh = await fetchMarketData(m.address);
        updated.push(fresh);
      } catch {
        updated.push(m);
      }
      await sleep(500);
    }
    cache.markets = updated;
    recordPrices(updated);
    console.log(`Background refresh done: ${updated.length} markets`);
  } catch (e) {
    console.error("Background refresh failed:", e.message);
  }
}

let refreshInProgress = null;

cache.refresh = async () => {
  // If refresh already running, wait for it instead of starting another
  if (refreshInProgress) {
    console.log("Refresh already in progress, waiting...");
    return refreshInProgress;
  }

  refreshInProgress = (async () => {
    console.log("Cache refresh triggered...");
    try {
      const markets = await loadAllMarkets();
      cache.markets = markets;
      console.log("Cache refresh done:", markets.length, "markets");
      recordPrices(markets);
    } catch (e) {
      console.error("Cache refresh FAILED:", e.message);
      if (!cache.markets) cache.markets = [];
    } finally {
      refreshInProgress = null;
    }
  })();

  // 30s timeout: return whatever we have if it takes too long
  const timeout = new Promise(resolve => setTimeout(() => {
    console.log("Refresh timeout after 30s");
    resolve();
  }, 30000));

  await Promise.race([refreshInProgress, timeout]);
};

// ---------- Express ----------
const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

app.use("/api/markets", createMarketsRouter({ provider, factoryAddress, factoryAbi, marketAbi, cache, priceHistory, tradeLogs }));
app.use("/api/comments", commentsRouter);
app.use("/api/users", usersRouter);

// ---------- Welcome Bonus (SQLite backed) ----------
const BONUS_AMOUNT = 2_000_000n; // $2 USDC
const BONUS_CAP = 250;
const bonusRateLimit = new Map(); // IP -> timestamp

const stmtCheckClaim = db.prepare("SELECT tx_hash FROM welcome_bonus_claims WHERE address = ?");
const stmtCountClaims = db.prepare("SELECT COUNT(*) AS cnt FROM welcome_bonus_claims");
const stmtInsertClaim = db.prepare("INSERT INTO welcome_bonus_claims (address, claimed_at, tx_hash, ip) VALUES (?, ?, ?, ?)");

app.get("/api/welcome-bonus-status", (req, res) => {
  const addr = (req.query.address || "").toLowerCase();
  if (!addr || !addr.startsWith("0x")) return res.json({ claimed: false });
  const row = stmtCheckClaim.get(addr);
  if (row) return res.json({ claimed: true, txHash: row.tx_hash });
  res.json({ claimed: false });
});

app.post("/api/claim-welcome-bonus", async (req, res) => {
  const addr = (req.body?.walletAddress || "").toLowerCase();
  if (!addr || !addr.startsWith("0x") || addr.length !== 42) {
    return res.json({ success: false, reason: "invalid_address" });
  }

  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  const lastClaim = bonusRateLimit.get(ip);
  if (lastClaim && Date.now() - lastClaim < 3600000) {
    return res.json({ success: false, reason: "rate_limited" });
  }

  if (stmtCheckClaim.get(addr)) {
    return res.json({ success: false, reason: "already_claimed" });
  }

  const { cnt } = stmtCountClaims.get();
  if (cnt >= BONUS_CAP) {
    return res.json({ success: false, reason: "bonus_pool_exhausted" });
  }

  const pk = process.env.BONUS_WALLET_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) return res.json({ success: false, reason: "server_config_error" });

  try {
    const signer = new ethers.Wallet(pk, provider);
    const usdc = new ethers.Contract(
      config.usdcAddress,
      ["function transfer(address to, uint256 amount) returns (bool)"],
      signer
    );
    const tx = await usdc.transfer(addr, BONUS_AMOUNT);
    const receipt = await tx.wait();

    stmtInsertClaim.run(addr, Date.now(), receipt.hash, ip);
    bonusRateLimit.set(ip, Date.now());

    console.log(`Welcome bonus: $2 sent to ${addr} tx:${receipt.hash}`);
    res.json({ success: true, txHash: receipt.hash, amount: "2.00" });
  } catch (e) {
    console.error("Welcome bonus failed:", e.message);
    res.json({ success: false, reason: "transfer_failed", details: e.message });
  }
});

// ---------- Referrals ----------
const REFERRAL_CAP = 150;
const REFERRAL_AMOUNT = 2_000_000n;
const stmtGetReferral = db.prepare("SELECT * FROM referrals WHERE referee_address = ?");
const stmtInsertReferral = db.prepare("INSERT INTO referrals (referee_address, referrer_address, signed_up_at) VALUES (?, ?, ?)");
const stmtMarkTrade = db.prepare("UPDATE referrals SET first_trade_at = ? WHERE referee_address = ? AND first_trade_at IS NULL");
const stmtMarkPayout = db.prepare("UPDATE referrals SET payout_tx_hash = ?, payout_at = ? WHERE referee_address = ?");
const stmtCountPayouts = db.prepare("SELECT COUNT(*) AS cnt FROM referrals WHERE payout_tx_hash IS NOT NULL");
const stmtReferrerStats = db.prepare(`
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN first_trade_at IS NOT NULL THEN 1 ELSE 0 END) AS activated,
    SUM(CASE WHEN payout_tx_hash IS NOT NULL THEN 1 ELSE 0 END) AS paid
  FROM referrals WHERE referrer_address = ?
`);

app.post("/api/register-referral", (req, res) => {
  const referee = (req.body?.referee || "").toLowerCase();
  const referrer = (req.body?.referrer || "").toLowerCase();
  if (!referee || !referrer || referee.length !== 42 || referrer.length !== 42) {
    return res.json({ success: false, reason: "invalid_address" });
  }
  if (referee === referrer) {
    return res.json({ success: false, reason: "self_referral" });
  }
  if (stmtGetReferral.get(referee)) {
    return res.json({ success: false, reason: "already_referred" });
  }
  try {
    stmtInsertReferral.run(referee, referrer, Date.now());
    console.log(`Referral registered: ${referrer.slice(0,10)} referred ${referee.slice(0,10)}`);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, reason: e.message });
  }
});

app.post("/api/check-referral-payout", async (req, res) => {
  const addr = (req.body?.address || "").toLowerCase();
  if (!addr || addr.length !== 42) return res.json({ success: true, paid: false });

  const row = stmtGetReferral.get(addr);
  if (!row || row.first_trade_at) return res.json({ success: true, paid: false });

  // Mark first trade
  stmtMarkTrade.run(Date.now(), addr);

  // Check cap
  const { cnt } = stmtCountPayouts.get();
  if (cnt >= REFERRAL_CAP) {
    console.log("Referral cap reached, skipping payout for", addr);
    return res.json({ success: true, paid: false, reason: "cap_reached" });
  }

  // Pay referrer
  const pk = process.env.BONUS_WALLET_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) return res.json({ success: true, paid: false, reason: "no_key" });

  try {
    const signer = new ethers.Wallet(pk, provider);
    const usdc = new ethers.Contract(
      config.usdcAddress,
      ["function transfer(address to, uint256 amount) returns (bool)"],
      signer
    );
    const tx = await usdc.transfer(row.referrer_address, REFERRAL_AMOUNT);
    const receipt = await tx.wait();
    stmtMarkPayout.run(receipt.hash, Date.now(), addr);
    console.log(`Referral payout: $2 to ${row.referrer_address.slice(0,10)} for ${addr.slice(0,10)} tx:${receipt.hash}`);
    res.json({ success: true, paid: true, txHash: receipt.hash, referrerAddress: row.referrer_address });
  } catch (e) {
    console.error("Referral payout failed:", e.message);
    res.json({ success: true, paid: false, reason: "transfer_failed" });
  }
});

app.get("/api/referral-stats", (req, res) => {
  const addr = (req.query.address || "").toLowerCase();
  if (!addr) return res.json({ totalReferred: 0, activated: 0, earned: 0, pending: 0 });
  const row = stmtReferrerStats.get(addr);
  if (!row) return res.json({ totalReferred: 0, activated: 0, earned: 0, pending: 0 });
  res.json({
    totalReferred: row.total,
    activated: row.activated,
    earned: row.paid * 2,
    pending: row.total - row.activated,
  });
});

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
