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

// ---------- Config ----------
function loadConfig() {
  let factoryAddress = process.env.FACTORY_ADDRESS || "";
  let usdcAddress = process.env.USDC_ADDRESS || "";
  let rpcUrl = process.env.RPC_URL || "";

  if (!factoryAddress || !usdcAddress) {
    try {
      const addrLocal = path.join(__dirname, "deployed-addresses-base-sepolia.json");
      const addrParent = path.join(__dirname, "..", "deployed-addresses-base-sepolia.json");
      const addrPath = fs.existsSync(addrLocal) ? addrLocal : addrParent;
      if (fs.existsSync(addrPath)) {
        const addrs = JSON.parse(fs.readFileSync(addrPath, "utf-8"));
        factoryAddress = factoryAddress || addrs.OPickFactory || "";
        usdcAddress = usdcAddress || addrs.MockUSDC || "";
      }
    } catch {}
  }

  if (!factoryAddress || !usdcAddress) {
    try {
      const configPath = path.join(__dirname, "..", "frontend", "src", "config.js");
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, "utf-8");
        const regex = /export\s+const\s+(\w+)\s*=\s*["'`]([^"'`]*)["'`]/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
          if (match[1] === "FACTORY_ADDRESS" && !factoryAddress) factoryAddress = match[2];
          if (match[1] === "USDC_ADDRESS" && !usdcAddress) usdcAddress = match[2];
          if (match[1] === "RPC_URL" && !rpcUrl) rpcUrl = match[2];
        }
      }
    } catch {}
  }

  rpcUrl = rpcUrl || "https://sepolia.base.org";
  return { factoryAddress, usdcAddress, rpcUrl };
}

const config = loadConfig();
console.log("Config:", config);

// ---------- Fallback RPC provider ----------
const RPC_URLS = [
  config.rpcUrl,
  "https://base-sepolia-rpc.publicnode.com",
  "https://base-sepolia.blockpi.network/v1/rpc/public",
  "https://sepolia.base.org",
];
// Deduplicate
const uniqueRpcs = [...new Set(RPC_URLS)];

const providers = uniqueRpcs.map((url) => new ethers.JsonRpcProvider(url));
// Use FallbackProvider: tries each in order, falls back on failure
const provider = new ethers.FallbackProvider(
  providers.map((p, i) => ({ provider: p, priority: i + 1, stallTimeout: 3000, weight: 1 })),
  1 // quorum of 1 — only need one to respond
);
console.log("RPC providers:", uniqueRpcs.length, "configured");

// ---------- ABIs ----------
function loadAbi(name) {
  const locations = [
    path.join(__dirname, "abi", `${name}.json`),
    path.join(__dirname, "..", "abi", `${name}.json`),
    path.join(__dirname, "..", "artifacts", "contracts", `${name}.sol`, `${name}.json`),
  ];
  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      const content = JSON.parse(fs.readFileSync(loc, "utf-8"));
      const abi = content.abi || content;
      console.log(`ABI ${name}: loaded ${abi.length} entries from ${loc}`);
      return abi;
    }
  }
  throw new Error(`ABI not found for ${name}`);
}

const factoryAbi = loadAbi("OPickFactory");
const marketAbi = loadAbi("OPickMarket");
const factoryAddress = config.factoryAddress;

// ---------- Express ----------
const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

app.use("/api/markets", createMarketsRouter({ provider, factoryAddress, factoryAbi, marketAbi }));
app.use("/api/comments", commentsRouter);
app.use("/api/users", usersRouter);

app.get("/api/health", async (req, res) => {
  const result = { rpcUrls: uniqueRpcs, factoryAddress };
  try {
    const network = await provider.getNetwork();
    result.chainId = Number(network.chainId);
    result.rpcOk = true;
  } catch (err) {
    result.rpcOk = false;
    result.rpcError = err.message;
  }
  try {
    const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
    const total = await factory.totalMarkets();
    result.totalMarkets = Number(total);
    result.contractCallOk = true;
  } catch (err) {
    result.contractCallOk = false;
    result.contractError = err.message;
  }
  result.status = result.contractCallOk ? "ok" : "error";
  res.json(result);
});

// ---------- WebSocket ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let knownMarketAddresses = [];

async function refreshMarketAddresses() {
  try {
    if (!factoryAddress) return;
    const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
    const total = await factory.totalMarkets();
    const count = Number(total);
    if (count === 0) { knownMarketAddresses = []; return; }
    const addresses = await factory.getMarkets(0, count);
    knownMarketAddresses = Array.from(addresses);
  } catch {}
}

async function broadcastPrices() {
  if (wss.clients.size === 0 || knownMarketAddresses.length === 0) return;
  try {
    const data = {};
    // Batch price fetches to avoid rate limits
    for (let i = 0; i < knownMarketAddresses.length; i += 4) {
      const batch = knownMarketAddresses.slice(i, i + 4);
      await Promise.all(batch.map(async (addr) => {
        try {
          const c = new ethers.Contract(addr, marketAbi, provider);
          const [pA, pB] = await Promise.all([c.priceA(), c.priceB()]);
          data[addr] = { priceA: pA.toString(), priceB: pB.toString() };
        } catch {}
      }));
    }
    const message = JSON.stringify({ type: "prices", data });
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(message);
    }
  } catch {}
}

refreshMarketAddresses();
setInterval(refreshMarketAddresses, 60_000);
setInterval(broadcastPrices, 5_000);

wss.on("connection", (ws) => {
  console.log("WS client connected");
  ws.on("close", () => console.log("WS client disconnected"));
});

// ---------- Startup preload ----------
const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`OPick backend on http://localhost:${PORT}`);
  // Preload markets cache so first request is instant
  try {
    console.log("Preloading markets cache...");
    const res = await fetch(`http://localhost:${PORT}/api/markets`);
    const data = await res.json();
    console.log(`Preloaded ${data.length} markets`);
  } catch (e) {
    console.log("Preload failed (will load on first request):", e.message);
  }
});
