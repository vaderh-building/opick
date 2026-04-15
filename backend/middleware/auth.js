import { PrivyClient } from "@privy-io/server-auth";

// ---------- Privy client ----------
const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;

if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
  console.warn("WARNING: PRIVY_APP_ID or PRIVY_APP_SECRET not set. Auth middleware will reject all requests.");
}

const privy = PRIVY_APP_ID && PRIVY_APP_SECRET
  ? new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET)
  : null;

// ---------- Token cache (60s TTL) ----------
const tokenCache = new Map(); // token -> { wallet, privyUserId, expiresAt }
const CACHE_TTL_MS = 60_000;

function getCached(token) {
  const entry = tokenCache.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tokenCache.delete(token);
    return null;
  }
  return entry;
}

function setCache(token, wallet, privyUserId) {
  tokenCache.set(token, { wallet, privyUserId, expiresAt: Date.now() + CACHE_TTL_MS });
  // Lazy cleanup: prune expired entries when cache gets large
  if (tokenCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of tokenCache) {
      if (now > v.expiresAt) tokenCache.delete(k);
    }
  }
}

// ---------- Core verification ----------
async function verifyToken(token) {
  // Check cache first
  const cached = getCached(token);
  if (cached) return cached;

  if (!privy) return null;

  // Step 1: verify JWT locally (no network call)
  const claims = await privy.verifyAuthToken(token);

  // Step 2: fetch user to get wallet address (hits Privy API, hence the cache)
  const user = await privy.getUserById(claims.userId);

  // Find the primary Ethereum wallet from linkedAccounts
  const ethWallet = user.linkedAccounts.find(
    (a) => a.type === "wallet" && a.chainType === "ethereum"
  );

  if (!ethWallet || !ethWallet.address) return null;

  const wallet = ethWallet.address.toLowerCase();
  const privyUserId = claims.userId;

  setCache(token, wallet, privyUserId);
  return { wallet, privyUserId };
}

// ---------- Middleware exports ----------

/**
 * Strict auth: rejects with 401 if no valid token.
 * Sets req.wallet (lowercase) and req.privyUserId.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = header.slice(7);
  try {
    const result = await verifyToken(token);
    if (!result) {
      return res.status(401).json({ error: "Authentication required" });
    }
    req.wallet = result.wallet;
    req.privyUserId = result.privyUserId;
    next();
  } catch (err) {
    console.error("Auth verification failed:", err.message);
    return res.status(401).json({ error: "Authentication required" });
  }
}

/**
 * Optional auth: sets req.wallet to the verified wallet or null.
 * Never rejects. Used for endpoints where auth is helpful but not required.
 */
export async function optionalAuth(req, res, next) {
  req.wallet = null;
  req.privyUserId = null;

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next();
  }

  const token = header.slice(7);
  try {
    const result = await verifyToken(token);
    if (result) {
      req.wallet = result.wallet;
      req.privyUserId = result.privyUserId;
    }
  } catch {}
  next();
}

/**
 * Admin auth: requires valid token AND wallet in ADMIN_WALLETS env var.
 * ADMIN_WALLETS is comma-separated, lowercase.
 */
const ADMIN_WALLETS = new Set(
  (process.env.ADMIN_WALLETS || "")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)
);

export async function requireAdmin(req, res, next) {
  // Run requireAuth first
  await requireAuth(req, res, () => {
    if (!req.wallet || !ADMIN_WALLETS.has(req.wallet)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  });
}
