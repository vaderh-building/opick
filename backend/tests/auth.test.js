/**
 * Smoke test for auth middleware.
 *
 * Tests the unauthenticated paths (no token, bad token) which don't need
 * a real Privy secret. For authenticated paths, use the curl examples at
 * the bottom against a running server with PRIVY_APP_SECRET set.
 *
 * Run: node tests/auth.test.js
 */

import express from "express";
import { requireAuth, optionalAuth, requireAdmin } from "../middleware/auth.js";

const app = express();
app.use(express.json());

app.get("/strict", requireAuth, (req, res) => {
  res.json({ wallet: req.wallet, privyUserId: req.privyUserId });
});

app.get("/optional", optionalAuth, (req, res) => {
  res.json({ wallet: req.wallet });
});

app.get("/admin", requireAdmin, (req, res) => {
  res.json({ wallet: req.wallet, admin: true });
});

const server = app.listen(0, async () => {
  const port = server.address().port;
  const base = `http://localhost:${port}`;
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      passed++;
      console.log(`  PASS: ${name}`);
    } catch (err) {
      failed++;
      console.error(`  FAIL: ${name} - ${err.message}`);
    }
  }

  function assert(cond, msg) {
    if (!cond) throw new Error(msg);
  }

  console.log("Auth middleware smoke tests\n");

  // --- requireAuth ---
  await test("requireAuth: no token returns 401", async () => {
    const res = await fetch(`${base}/strict`);
    assert(res.status === 401, `expected 401, got ${res.status}`);
    const body = await res.json();
    assert(body.error === "Authentication required", `unexpected body: ${JSON.stringify(body)}`);
  });

  await test("requireAuth: invalid token returns 401", async () => {
    const res = await fetch(`${base}/strict`, {
      headers: { Authorization: "Bearer totally.invalid.token" },
    });
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  await test("requireAuth: malformed header returns 401", async () => {
    const res = await fetch(`${base}/strict`, {
      headers: { Authorization: "Basic abc123" },
    });
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  // --- optionalAuth ---
  await test("optionalAuth: no token sets wallet to null", async () => {
    const res = await fetch(`${base}/optional`);
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.wallet === null, `expected null wallet, got ${body.wallet}`);
  });

  await test("optionalAuth: invalid token sets wallet to null (no error)", async () => {
    const res = await fetch(`${base}/optional`, {
      headers: { Authorization: "Bearer bad.token.here" },
    });
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.wallet === null, `expected null wallet, got ${body.wallet}`);
  });

  // --- requireAdmin ---
  await test("requireAdmin: no token returns 401", async () => {
    const res = await fetch(`${base}/admin`);
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log("Some tests failed.");
  }

  /**
   * Manual testing with a real Privy token:
   *
   * 1. Get a token from the frontend (browser devtools):
   *    const token = await window.__PRIVY_TOKEN__; // or from Privy hooks
   *
   *    Or from the Privy React SDK:
   *    const { getAccessToken } = usePrivy();
   *    const token = await getAccessToken();
   *
   * 2. Test requireAuth:
   *    curl -H "Authorization: Bearer <token>" http://localhost:3001/strict
   *    Expected: { "wallet": "0x...", "privyUserId": "did:privy:..." }
   *
   * 3. Test requireAdmin (with admin wallet):
   *    curl -H "Authorization: Bearer <token>" http://localhost:3001/admin
   *    Expected: { "wallet": "0x...", "admin": true }
   *    Or 403 if wallet not in ADMIN_WALLETS
   */

  server.close();
  process.exit(failed > 0 ? 1 : 0);
});
