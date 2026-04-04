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
      const addrLocal = path.join(__dirname, "deployed-addresses-base-sepolia.json");
      const addrParent = path.join(__dirname, "..", "deployed-addresses-base-sepolia.json");
      const addrPath = fs.existsSync(addrLocal) ? addrLocal : addrParent;
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

function loadAbi(name) {
  const locations = [
    path.join(__dirname, "abi", `${name}.json`),
    path.join(__dirname, "..", "abi", `${name}.json`),
    path.join(__dirname, "..", "artifacts", "contracts", `${name}.sol`, `${name}.json`),
  ];
  for (const loc of locations) {
    const exists = fs.existsSync(loc);
    console.log(`  ABI ${name}: ${loc} → ${exists ? "FOUND" : "missing"}`);
    if (exists) {
      const content = JSON.parse(fs.readFileSync(loc, "utf-8"));
      const abi = content.abi || content;
      console.log(`  ABI ${name}: loaded ${abi.length} entries`);
      return abi;
    }
  }
  throw new Error(`ABI not found for ${name}. Searched: ${locations.join(", ")}`);
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

app.get("/api/health", async (req, res) => {
  const result = { rpcUrl: config.rpcUrl, factoryAddress, __dirname, cwd: process.cwd() };
  try {
    const network = await provider.getNetwork();
    result.chainId = Number(network.chainId);
    result.rpcOk = true;
  } catch (err) {
    result.rpcOk = false;
    result.rpcError = err.message;
  }
  try {
    const code = await provider.getCode(factoryAddress);
    result.codeLength = code.length;
    result.hasCode = code !== "0x";
  } catch (err) {
    result.codeError = err.message;
  }
  result.abiLoaded = Array.isArray(factoryAbi);
  result.abiLength = factoryAbi?.length || 0;
  result.abiFunctions = factoryAbi?.filter(e => e.type === "function").map(e => e.name) || [];
  try {
    const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
    const total = await factory.totalMarkets();
    result.totalMarkets = Number(total);
    result.contractCallOk = true;
  } catch (err) {
    result.contractCallOk = false;
    result.contractError = err.message;
    result.contractErrorCode = err.code;
  }
  result.status = result.contractCallOk ? "ok" : "error";
  res.json(result);
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
