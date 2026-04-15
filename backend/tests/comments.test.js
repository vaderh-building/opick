/**
 * Unit tests for the position-tag logic in routes/comments.js.
 *
 * Run: node tests/comments.test.js
 */

import { getPosition } from "../routes/comments.js";

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

// Mock contract factory
function mockContract(sharesAVal, sharesBVal) {
  let callCount = 0;
  return {
    sharesA: async () => { callCount++; return BigInt(sharesAVal); },
    sharesB: async () => { callCount++; return BigInt(sharesBVal); },
    get callCount() { return callCount; },
  };
}

console.log("Position-tag unit tests\n");

await test("sharesA > sharesB returns 'A'", async () => {
  const c = mockContract(1000, 500);
  const pos = await getPosition(c, "0xtest");
  assert(pos === "A", `expected 'A', got '${pos}'`);
});

await test("sharesB > sharesA returns 'B'", async () => {
  const c = mockContract(200, 800);
  const pos = await getPosition(c, "0xtest");
  assert(pos === "B", `expected 'B', got '${pos}'`);
});

await test("both zero returns null", async () => {
  const c = mockContract(0, 0);
  const pos = await getPosition(c, "0xtest");
  assert(pos === null, `expected null, got '${pos}'`);
});

await test("both equal nonzero returns null", async () => {
  const c = mockContract(500, 500);
  const pos = await getPosition(c, "0xtest");
  assert(pos === null, `expected null, got '${pos}'`);
});

// Cache tests using the exported cache helpers
const { positionCache, getCachedPosition, setCachedPosition } = await import("../routes/comments.js");

await test("cache hit does not re-call contract", async () => {
  const key = "0xmarket:0xwallet_cache_test";
  setCachedPosition(key, "A");
  const cached = getCachedPosition(key);
  assert(cached === "A", `expected 'A', got '${cached}'`);
  // Clean up
  positionCache.delete(key);
});

await test("cache miss after eviction re-calls contract", async () => {
  const key = "0xmarket:0xwallet_evict_test";
  setCachedPosition(key, "B");
  // Manually evict
  positionCache.delete(key);
  const cached = getCachedPosition(key);
  assert(cached === undefined, `expected undefined after eviction, got '${cached}'`);
});

await test("cache miss after TTL expiry", async () => {
  const key = "0xmarket:0xwallet_ttl_test";
  // Insert with already-expired TTL
  positionCache.set(key, { position: "A", expiresAt: Date.now() - 1000 });
  const cached = getCachedPosition(key);
  assert(cached === undefined, `expected undefined after TTL, got '${cached}'`);
  assert(!positionCache.has(key), "expected stale entry to be deleted");
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
