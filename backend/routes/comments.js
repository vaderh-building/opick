import { Router } from "express";
import { ethers } from "ethers";
import crypto from "crypto";
import db from "../db.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { isBlocked } from "../middleware/moderation.js";

const ADMIN_WALLETS = new Set(
  (process.env.ADMIN_WALLETS || "").split(",").map((w) => w.trim().toLowerCase()).filter(Boolean)
);

const VALID_REASONS = new Set(["spam", "harassment", "illegal", "other"]);

// ---------- Position cache ----------
// Key: "marketAddress:wallet" -> { position, expiresAt }
const positionCache = new Map();
const POS_CACHE_TTL = 60_000;

function getCachedPosition(key) {
  const entry = positionCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { positionCache.delete(key); return undefined; }
  return entry.position;
}

function setCachedPosition(key, position) {
  positionCache.set(key, { position, expiresAt: Date.now() + POS_CACHE_TTL });
  if (positionCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of positionCache) {
      if (now > v.expiresAt) positionCache.delete(k);
    }
  }
}

// Exported for testing
export async function getPosition(contract, wallet) {
  const [sharesA, sharesB] = await Promise.all([
    contract.sharesA(wallet),
    contract.sharesB(wallet),
  ]);
  // sharesA = side A position, sharesB = side B position
  // Matches the contract's sideAName/sideBName convention
  if (sharesA > sharesB) return "A";
  if (sharesB > sharesA) return "B";
  return null;
}

async function resolvePositions(marketAddress, wallets, provider, marketAbi) {
  if (wallets.length === 0) return new Map();
  const contract = new ethers.Contract(marketAddress, marketAbi, provider);
  const result = new Map();

  const uncached = [];
  for (const w of wallets) {
    const key = `${marketAddress}:${w}`;
    const cached = getCachedPosition(key);
    if (cached !== undefined) {
      result.set(w, cached);
    } else {
      uncached.push(w);
    }
  }

  if (uncached.length > 0) {
    const promises = uncached.map(async (w) => {
      try {
        const pos = await getPosition(contract, w);
        const key = `${marketAddress}:${w}`;
        setCachedPosition(key, pos);
        result.set(w, pos);
      } catch (err) {
        console.error(`Position lookup failed for ${w}:`, err.message.slice(0, 80));
        result.set(w, null);
      }
    });
    await Promise.all(promises);
  }

  return result;
}

// ---------- Helpers ----------
function getBannedWallets() {
  return new Set(
    db.prepare("SELECT wallet_address FROM shadowbans").all().map((r) => r.wallet_address)
  );
}

function formatComment(row, positionMap, likeCounts, myLikes) {
  const isDeleted = !!row.deleted_at;
  const isHidden = !!row.auto_hidden_at;

  if (isDeleted) {
    return {
      id: row.id,
      body: null,
      created_at: row.created_at,
      deleted_at: row.deleted_at,
      hidden: false,
      author: null,
      author_position: null,
      like_count: 0,
      liked_by_me: false,
    };
  }

  if (isHidden) {
    return {
      id: row.id,
      body: null,
      created_at: row.created_at,
      deleted_at: null,
      hidden: true,
      author: null,
      author_position: null,
      like_count: 0,
      liked_by_me: false,
    };
  }

  return {
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    deleted_at: null,
    hidden: false,
    author: {
      wallet_address: row.author_wallet,
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    },
    author_position: positionMap.get(row.author_wallet) || null,
    like_count: likeCounts.get(row.id) || 0,
    liked_by_me: myLikes.has(row.id),
  };
}

function batchLikeData(commentIds, viewerWallet) {
  const likeCounts = new Map();
  const myLikes = new Set();
  if (commentIds.length === 0) return { likeCounts, myLikes };

  const placeholders = commentIds.map(() => "?").join(",");
  const counts = db.prepare(
    `SELECT comment_id, COUNT(*) as c FROM comment_likes WHERE comment_id IN (${placeholders}) GROUP BY comment_id`
  ).all(...commentIds);
  for (const r of counts) likeCounts.set(r.comment_id, r.c);

  if (viewerWallet) {
    const liked = db.prepare(
      `SELECT comment_id FROM comment_likes WHERE comment_id IN (${placeholders}) AND wallet_address = ?`
    ).all(...commentIds, viewerWallet);
    for (const r of liked) myLikes.add(r.comment_id);
  }

  return { likeCounts, myLikes };
}

function checkRateLimit(wallet, action, maxPerMinute, maxPerHour) {
  const perMin = db.prepare(
    "SELECT COUNT(*) as c FROM rate_limits WHERE wallet_address = ? AND action = ? AND created_at > datetime('now', '-1 minute')"
  ).get(wallet, action).c;

  if (perMin >= maxPerMinute) {
    // Estimate seconds until oldest entry in window expires
    const oldest = db.prepare(
      "SELECT created_at FROM rate_limits WHERE wallet_address = ? AND action = ? AND created_at > datetime('now', '-1 minute') ORDER BY created_at ASC LIMIT 1"
    ).get(wallet, action);
    const retrySeconds = oldest
      ? Math.max(1, Math.ceil((new Date(oldest.created_at + "Z").getTime() + 60000 - Date.now()) / 1000))
      : 60;
    return { limited: true, retry_after_seconds: retrySeconds };
  }

  const perHour = db.prepare(
    "SELECT COUNT(*) as c FROM rate_limits WHERE wallet_address = ? AND action = ? AND created_at > datetime('now', '-1 hour')"
  ).get(wallet, action).c;

  if (perHour >= maxPerHour) {
    const oldest = db.prepare(
      "SELECT created_at FROM rate_limits WHERE wallet_address = ? AND action = ? AND created_at > datetime('now', '-1 hour') ORDER BY created_at ASC LIMIT 1"
    ).get(wallet, action);
    const retrySeconds = oldest
      ? Math.max(1, Math.ceil((new Date(oldest.created_at + "Z").getTime() + 3600000 - Date.now()) / 1000))
      : 3600;
    return { limited: true, retry_after_seconds: retrySeconds };
  }

  return { limited: false };
}

// ---------- Router factory ----------
export default function createCommentsRouter({ provider, marketAbi }) {
  const router = Router();

  // ---------- GET /api/markets/:marketAddress/comments ----------
  router.get("/markets/:marketAddress/comments", optionalAuth, async (req, res) => {
    try {
      const marketAddress = req.params.marketAddress.toLowerCase();
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
      const cursor = req.query.cursor || null;

      const bannedWallets = getBannedWallets();
      const viewerWallet = req.wallet;

      // Fetch top-level comments (parent_comment_id IS NULL), newest first
      let topQuery = `
        SELECT c.*, p.username, p.display_name, p.avatar_url
        FROM comments c
        LEFT JOIN profiles p ON c.author_wallet = p.wallet_address
        WHERE c.market_address = ? AND c.parent_comment_id IS NULL
      `;
      const queryParams = [marketAddress];

      if (cursor) {
        // Cursor-based pagination: get comments created before the cursor comment
        const cursorComment = db.prepare("SELECT created_at FROM comments WHERE id = ?").get(cursor);
        if (cursorComment) {
          topQuery += " AND c.created_at < ?";
          queryParams.push(cursorComment.created_at);
        }
      }

      topQuery += " ORDER BY c.created_at DESC LIMIT ?";
      queryParams.push(limit + 1); // fetch one extra to determine next_cursor

      const topRows = db.prepare(topQuery).all(...queryParams);
      const hasMore = topRows.length > limit;
      if (hasMore) topRows.pop();

      // Filter shadowbanned (but keep if viewer is the banned author)
      const visibleTop = topRows.filter((r) => {
        if (!bannedWallets.has(r.author_wallet)) return true;
        return viewerWallet === r.author_wallet;
      });

      // Fetch replies for visible top-level comments
      const topIds = visibleTop.map((r) => r.id);
      let repliesByParent = {};
      let repliesHasMore = {};

      if (topIds.length > 0) {
        const placeholders = topIds.map(() => "?").join(",");
        // Fetch up to 11 replies per parent to detect has_more
        const allReplies = db.prepare(`
          SELECT c.*, p.username, p.display_name, p.avatar_url
          FROM comments c
          LEFT JOIN profiles p ON c.author_wallet = p.wallet_address
          WHERE c.parent_comment_id IN (${placeholders})
          ORDER BY c.created_at ASC
        `).all(...topIds);

        for (const r of allReplies) {
          const pid = r.parent_comment_id;
          if (!repliesByParent[pid]) repliesByParent[pid] = [];
          // Filter shadowbanned replies
          if (bannedWallets.has(r.author_wallet) && viewerWallet !== r.author_wallet) continue;
          repliesByParent[pid].push(r);
        }

        for (const pid of topIds) {
          const arr = repliesByParent[pid] || [];
          if (arr.length > 10) {
            repliesHasMore[pid] = true;
            repliesByParent[pid] = arr.slice(0, 10);
          } else {
            repliesHasMore[pid] = false;
          }
        }
      }

      // Collect all unique wallets for position lookup
      const allRows = [...visibleTop];
      for (const arr of Object.values(repliesByParent)) allRows.push(...arr);
      const uniqueWallets = [...new Set(
        allRows
          .filter((r) => !r.deleted_at && !r.auto_hidden_at)
          .map((r) => r.author_wallet)
      )];

      const positionMap = await resolvePositions(marketAddress, uniqueWallets, provider, marketAbi);

      // Batch like data for all comment IDs
      const allCommentIds = [...visibleTop.map((r) => r.id)];
      for (const arr of Object.values(repliesByParent)) {
        for (const r of arr) allCommentIds.push(r.id);
      }
      const { likeCounts, myLikes } = batchLikeData(allCommentIds, viewerWallet);

      // Format response
      const comments = visibleTop.map((row) => {
        const formatted = formatComment(row, positionMap, likeCounts, myLikes);
        const replies = (repliesByParent[row.id] || []).map((r) => formatComment(r, positionMap, likeCounts, myLikes));
        return {
          ...formatted,
          replies,
          // TODO Phase 2: separate endpoint GET /api/comments/:id/replies for full thread
          replies_has_more: repliesHasMore[row.id] || false,
        };
      });

      const nextCursor = hasMore && visibleTop.length > 0
        ? visibleTop[visibleTop.length - 1].id
        : null;

      res.json({ comments, next_cursor: nextCursor });
    } catch (err) {
      console.error("GET comments error:", err.message);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  // ---------- POST /api/markets/:marketAddress/comments ----------
  router.post("/markets/:marketAddress/comments", requireAuth, async (req, res) => {
    try {
      const marketAddress = req.params.marketAddress.toLowerCase();
      const { body: rawBody, parent_comment_id } = req.body;

      // 1. Profile required
      const profile = db.prepare("SELECT * FROM profiles WHERE wallet_address = ?").get(req.wallet);
      if (!profile) {
        return res.status(400).json({ error: "Profile required to comment", code: "PROFILE_REQUIRED" });
      }

      // 2. Body validation
      const body = (rawBody || "").trim();
      if (body.length < 1 || body.length > 500) {
        return res.status(400).json({ error: "Comment must be 1-500 characters", code: "INVALID_LENGTH" });
      }

      // 3. Parent validation (single-level replies only)
      if (parent_comment_id) {
        const parent = db.prepare("SELECT id, parent_comment_id, deleted_at FROM comments WHERE id = ?").get(parent_comment_id);
        if (!parent || parent.deleted_at) {
          return res.status(400).json({ error: "Parent comment not found", code: "PARENT_NOT_FOUND" });
        }
        if (parent.parent_comment_id !== null) {
          return res.status(400).json({ error: "Cannot reply to a reply", code: "NESTED_REPLY" });
        }
      }

      // 4. Rate limit: 5/min, 50/hour
      const rl = checkRateLimit(req.wallet, "comment_create", 5, 50);
      if (rl.limited) {
        return res.status(429).json({ error: "Slow down", code: "RATE_LIMITED", retry_after_seconds: rl.retry_after_seconds });
      }

      // 5. Content filter
      if (isBlocked(body)) {
        return res.status(400).json({ error: "Comment not allowed", code: "CONTENT_BLOCKED" });
      }

      // 6. Shadowban: allow insert silently (GET will hide from others)

      // Insert
      const id = crypto.randomUUID();
      db.prepare(
        `INSERT INTO comments (id, market_address, parent_comment_id, author_wallet, body)
         VALUES (?, ?, ?, ?, ?)`
      ).run(id, marketAddress, parent_comment_id || null, req.wallet, body);

      // Record rate limit
      db.prepare(
        "INSERT INTO rate_limits (wallet_address, action) VALUES (?, 'comment_create')"
      ).run(req.wallet);

      // Fetch and return with profile + position
      const row = db.prepare(`
        SELECT c.*, p.username, p.display_name, p.avatar_url
        FROM comments c
        LEFT JOIN profiles p ON c.author_wallet = p.wallet_address
        WHERE c.id = ?
      `).get(id);

      const positionMap = await resolvePositions(marketAddress, [req.wallet], provider, marketAbi);
      const formatted = formatComment(row, positionMap, new Map(), new Set());

      res.status(201).json(formatted);
    } catch (err) {
      console.error("POST comment error:", err.message);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  // ---------- DELETE /api/comments/:id ----------
  router.delete("/comments/:id", requireAuth, (req, res) => {
    const comment = db.prepare("SELECT id, author_wallet, deleted_at FROM comments WHERE id = ?").get(req.params.id);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found", code: "NOT_FOUND" });
    }
    if (comment.deleted_at) {
      return res.status(404).json({ error: "Comment already deleted", code: "NOT_FOUND" });
    }

    const isAuthor = req.wallet === comment.author_wallet;
    const isAdmin = ADMIN_WALLETS.has(req.wallet);
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
    }

    db.prepare(
      "UPDATE comments SET deleted_at = datetime('now'), deleted_by = ? WHERE id = ?"
    ).run(isAdmin && !isAuthor ? "admin" : "author", req.params.id);

    res.status(204).end();
  });

  // ---------- POST /api/comments/:id/report ----------
  router.post("/comments/:id/report", requireAuth, (req, res) => {
    const { reason } = req.body;
    if (!reason || !VALID_REASONS.has(reason)) {
      return res.status(400).json({ error: "Invalid reason. Must be: spam, harassment, illegal, other", code: "INVALID_REASON" });
    }

    const comment = db.prepare("SELECT id, deleted_at FROM comments WHERE id = ?").get(req.params.id);
    if (!comment || comment.deleted_at) {
      return res.status(404).json({ error: "Comment not found", code: "NOT_FOUND" });
    }

    // Rate limit: 10 reports per wallet per hour
    const rl = checkRateLimit(req.wallet, "comment_report", 10, 100);
    if (rl.limited) {
      return res.status(429).json({ error: "Slow down", code: "RATE_LIMITED", retry_after_seconds: rl.retry_after_seconds });
    }

    try {
      const reportId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO comment_reports (id, comment_id, reporter_wallet, reason)
         VALUES (?, ?, ?, ?)`
      ).run(reportId, req.params.id, req.wallet, reason);

      // Record rate limit
      db.prepare(
        "INSERT INTO rate_limits (wallet_address, action) VALUES (?, 'comment_report')"
      ).run(req.wallet);

      // Check if 5+ unresolved reports -> auto-hide
      const reportCount = db.prepare(
        "SELECT COUNT(*) as c FROM comment_reports WHERE comment_id = ? AND resolved_at IS NULL"
      ).get(req.params.id).c;

      if (reportCount >= 5) {
        db.prepare(
          "UPDATE comments SET auto_hidden_at = datetime('now') WHERE id = ? AND auto_hidden_at IS NULL"
        ).run(req.params.id);
      }

      res.status(201).json({ id: reportId });
    } catch (err) {
      if (err.message.includes("UNIQUE constraint")) {
        return res.status(409).json({ error: "Already reported", code: "ALREADY_REPORTED" });
      }
      console.error("Report error:", err.message);
      res.status(500).json({ error: "Failed to report comment" });
    }
  });

  // ---------- POST /api/comments/:id/like ----------
  router.post("/comments/:id/like", requireAuth, (req, res) => {
    const comment = db.prepare("SELECT id, deleted_at FROM comments WHERE id = ?").get(req.params.id);
    if (!comment || comment.deleted_at) {
      return res.status(404).json({ error: "Comment not found", code: "NOT_FOUND" });
    }

    // Rate limit: 30 per minute
    const rl = checkRateLimit(req.wallet, "comment_like", 30, 1000);
    if (rl.limited) {
      return res.status(429).json({ error: "Slow down", code: "RATE_LIMITED", retry_after_seconds: rl.retry_after_seconds });
    }

    const existing = db.prepare(
      "SELECT comment_id FROM comment_likes WHERE comment_id = ? AND wallet_address = ?"
    ).get(req.params.id, req.wallet);

    if (existing) {
      db.prepare("DELETE FROM comment_likes WHERE comment_id = ? AND wallet_address = ?")
        .run(req.params.id, req.wallet);
    } else {
      db.prepare("INSERT INTO comment_likes (comment_id, wallet_address) VALUES (?, ?)")
        .run(req.params.id, req.wallet);
    }

    db.prepare("INSERT INTO rate_limits (wallet_address, action) VALUES (?, 'comment_like')")
      .run(req.wallet);

    const likeCount = db.prepare(
      "SELECT COUNT(*) as c FROM comment_likes WHERE comment_id = ?"
    ).get(req.params.id).c;

    res.json({ liked: !existing, like_count: likeCount });
  });

  return router;
}

export { positionCache, getCachedPosition, setCachedPosition };
