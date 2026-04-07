import { spawn, execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const NODE_BIN = process.env.HOME + "/.nvm/versions/node/v22.22.2/bin";
const env = { ...process.env, PATH: `${NODE_BIN}:${process.env.PATH}` };

const children = [];

function spawnChild(cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    stdio: "pipe",
    env,
    cwd: ROOT,
    ...opts,
  });

  const label = opts.label || `[${cmd} ${args[0] || ""}]`;

  if (child.stdout) {
    child.stdout.on("data", (data) => {
      for (const line of data.toString().split("\n").filter(Boolean)) {
        console.log(`${label} ${line}`);
      }
    });
  }
  if (child.stderr) {
    child.stderr.on("data", (data) => {
      for (const line of data.toString().split("\n").filter(Boolean)) {
        console.error(`${label} ${line}`);
      }
    });
  }

  children.push(child);
  return child;
}

function runHardhatScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["hardhat", "run", `scripts/${scriptName}`, "--network", "localhost"], {
      stdio: "inherit",
      env,
      cwd: ROOT,
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

function cleanup() {
  console.log("\nShutting down all processes...");
  for (const child of children) {
    if (!child.killed) {
      console.log(`  Killing PID ${child.pid}`);
      child.kill("SIGTERM");
    }
  }
  // Force-kill after 3 seconds
  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
    process.exit(0);
  }, 3000);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("========================================");
  console.log("  OPick – Starting All Services");
  console.log("========================================\n");

  // 1. Start Hardhat node
  console.log("[1/5] Starting Hardhat node...");
  const hardhatNode = spawnChild("npx", ["hardhat", "node"], { label: "[hardhat]" });

  // Wait for node to be ready
  await sleep(3000);
  console.log("[1/5] Hardhat node started (PID: " + hardhatNode.pid + ")\n");

  // 2. Deploy contracts
  console.log("[2/5] Deploying contracts...");
  await runHardhatScript("deploy-local.mjs");
  console.log("[2/5] Contracts deployed.\n");

  // 3. Seed markets
  console.log("[3/5] Seeding markets...");
  await runHardhatScript("seed-markets.mjs");
  console.log("[3/5] Markets seeded.\n");

  // 4. Start backend
  console.log("[4/5] Starting backend server...");
  const backend = spawnChild("node", ["backend/server.js"], { label: "[backend]" });
  console.log("[4/5] Backend started (PID: " + backend.pid + ")\n");

  // 5. Start frontend
  console.log("[5/5] Starting frontend dev server...");
  const frontend = spawnChild("npx", ["vite", "--host"], {
    label: "[frontend]",
    cwd: path.join(ROOT, "frontend"),
  });
  console.log("[5/5] Frontend started (PID: " + frontend.pid + ")\n");

  console.log("========================================");
  console.log("  All services running!");
  console.log("========================================");
  console.log("  Hardhat node : PID " + hardhatNode.pid);
  console.log("  Backend      : PID " + backend.pid);
  console.log("  Frontend     : PID " + frontend.pid);
  console.log("========================================");
  console.log("  Press Ctrl+C to stop all services");
  console.log("========================================\n");
}

main().catch((e) => {
  console.error("Startup failed:", e);
  cleanup();
});
