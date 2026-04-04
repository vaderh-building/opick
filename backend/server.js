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

// ---------- Config from env vars, with fallbacks ----------
function loadConfig() {
  // Priority: env vars > deployed-addresses JSON > frontend config.js
  let factoryAddress = process.env.FACTORY_ADDRESS || "";
  let usdcAddress = process.env.USDC_ADDRESS || "";
  let rpcUrl = process.env.RPC_URL || "";

  // Try deployed-addresses file
  if (!factoryAddress || !usdcAddress) {
    try {
      const addrPath = path.join(__dirname, "..", "deployed-addresses-base-sepolia.json");
      if (fs.existsSync(addrPath)) {
        const addrs = JSON.parse(fs.readFileSync(addrPath, "utf-8"));
        factoryAddress = factoryAddress || addrs.OPickFactory || "";
        usdcAddress = usdcAddress || addrs.MockUSDC || "";
        if (!rpcUrl) rpcUrl = "https://sepolia.base.org";
      }
    } catch {}
  }

  // Try frontend config.js
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

  rpcUrl = rpcUrl || "http://127.0.0.1:8545";

  return { factoryAddress, usdcAddress, rpcUrl };
}

const config = loadConfig();
console.log("Config:", {
  rpcUrl: config.rpcUrl,
  factoryAddress: config.factoryAddress,
  usdcAddress: config.usdcAddress,
});

// ---------- Ethers provider & ABIs ----------
const provider = new ethers.JsonRpcProvider(config.rpcUrl);

// Try abi/ dir first (committed to git), fall back to artifacts/ (local dev)
function loadAbi(name) {
  const abiDir = path.join(__dirname, "..", "abi", `${name}.json`);
  const artifactDir = path.join(__dirname, "..", "artifacts", "contracts", `${name}.sol`, `${name}.json`);
  const filePath = fs.existsSync(abiDir) ? abiDir : artifactDir;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")).abi;
}

const factoryAbi = loadAbi("OPickFactory");
const marketAbi = loadAbi("OPickMarket");

const factoryAddress = config.factoryAddress;

// ---------- Express app ----------
const app = express();

const corsOrigin = process.env.FRONTEND_URL || "*";
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.use("/api/markets", createMarketsRouter({ provider, factoryAddress, factoryAbi, marketAbi }));
app.use("/api/comments", commentsRouter);
app.use("/api/users", usersRouter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", factoryAddress, rpcUrl: config.rpcUrl });
});

// ---------- HTTP + WebSocket server ----------
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
    await Promise.all(
      knownMarketAddresses.map(async (addr) => {
        try {
          const contract = new ethers.Contract(addr, marketAbi, provider);
          const [priceA, priceB] = await Promise.all([contract.priceA(), contract.priceB()]);
          data[addr] = { priceA: priceA.toString(), priceB: priceB.toString() };
        } catch {}
      })
    );
    const message = JSON.stringify({ type: "prices", data });
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(message);
    }
  } catch (error) {
    console.error("Error broadcasting prices:", error.message);
  }
}

refreshMarketAddresses();
setInterval(refreshMarketAddresses, 30_000);
setInterval(broadcastPrices, 3_000);

wss.on("connection", (ws) => {
  console.log("WebSocket client connected");
  ws.on("close", () => console.log("WebSocket client disconnected"));
});

// ---------- Start ----------
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`OPick backend running on http://localhost:${PORT}`);
  console.log(`WebSocket server on ws://localhost:${PORT}`);
});
