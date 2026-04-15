import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dbPath = process.env.DB_PATH || path.join(process.cwd(), "data", "opick.db");
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
console.log("DB path:", dbPath, "exists:", fs.existsSync(dbPath));

const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---------- Migration: legacy table cleanup ----------
// Must run BEFORE schema creation so CREATE TABLE IF NOT EXISTS
// picks up the correct schema rather than silently keeping the old one.

// If comments_v2 exists, the DB was created with the Phase 1 v2 schema.
// Rename it to comments (dropping the legacy comments + comment_likes first).
const hasV2 = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='comments_v2'").get();
if (hasV2) {
  db.pragma("foreign_keys = OFF");
  db.exec(`
    DROP TABLE IF EXISTS comment_likes;
    DROP TABLE IF EXISTS comments;
    ALTER TABLE comments_v2 RENAME TO comments;
  `);
  db.pragma("foreign_keys = ON");
  console.log("Migration: renamed comments_v2 -> comments, dropped legacy tables");
} else {
  // No v2 table. Check if the old-schema comments table exists (has user_address column).
  const oldComments = db.prepare(
    "SELECT name FROM pragma_table_info('comments') WHERE name = 'user_address'"
  ).get();
  if (oldComments) {
    db.pragma("foreign_keys = OFF");
    db.exec(`
      DROP TABLE IF EXISTS comment_likes;
      DROP TABLE IF EXISTS comments;
    `);
    db.pragma("foreign_keys = ON");
    console.log("Migration: dropped legacy comments + comment_likes (old schema)");
  }
}

// Drop stale v2-named indexes if they survived the rename
db.exec(`
  DROP INDEX IF EXISTS idx_comments_v2_market;
  DROP INDEX IF EXISTS idx_comments_v2_author;
  DROP INDEX IF EXISTS idx_comments_v2_created;
  DROP INDEX IF EXISTS idx_comment_likes_comment;
`);

// ---------- Schema ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    address TEXT PRIMARY KEY,
    username TEXT,
    avatar_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS welcome_bonus_claims (
    address TEXT PRIMARY KEY,
    claimed_at INTEGER NOT NULL,
    tx_hash TEXT,
    ip TEXT
  );

  CREATE TABLE IF NOT EXISTS referrals (
    referee_address TEXT PRIMARY KEY,
    referrer_address TEXT NOT NULL,
    signed_up_at INTEGER NOT NULL,
    first_trade_at INTEGER,
    payout_tx_hash TEXT,
    payout_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_referrer ON referrals(referrer_address);

  -- ==========================================================
  -- Comment system tables
  -- ==========================================================

  CREATE TABLE IF NOT EXISTS profiles (
    wallet_address TEXT PRIMARY KEY
      CHECK(wallet_address = lower(wallet_address)),
    username TEXT UNIQUE
      CHECK(length(username) BETWEEN 3 AND 20
        AND username GLOB '[a-z0-9_]*'
        AND username = lower(username)),
    display_name TEXT
      CHECK(display_name IS NULL OR length(display_name) <= 40),
    bio TEXT
      CHECK(bio IS NULL OR length(bio) <= 160),
    avatar_url TEXT,
    username_changed_at TEXT,  -- ISO 8601, for 30-day cooldown
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,  -- UUID generated in application
    market_address TEXT NOT NULL,
    parent_comment_id TEXT
      REFERENCES comments(id),
    author_wallet TEXT NOT NULL
      REFERENCES profiles(wallet_address),
    body TEXT NOT NULL
      CHECK(length(body) BETWEEN 1 AND 500),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,        -- ISO 8601, soft delete
    deleted_by TEXT         -- 'author' or 'admin'
      CHECK(deleted_by IS NULL OR deleted_by IN ('author', 'admin'))
  );

  CREATE INDEX IF NOT EXISTS idx_comments_market
    ON comments(market_address);
  CREATE INDEX IF NOT EXISTS idx_comments_author
    ON comments(author_wallet);
  CREATE INDEX IF NOT EXISTS idx_comments_created
    ON comments(created_at);

  CREATE TABLE IF NOT EXISTS comment_reports (
    id TEXT PRIMARY KEY,  -- UUID generated in application
    comment_id TEXT NOT NULL
      REFERENCES comments(id),
    reporter_wallet TEXT NOT NULL,
    reason TEXT NOT NULL
      CHECK(reason IN ('spam', 'harassment', 'illegal', 'other')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT,
    UNIQUE(comment_id, reporter_wallet)
  );

  CREATE TABLE IF NOT EXISTS rate_limits (
    wallet_address TEXT NOT NULL,
    action TEXT NOT NULL
      CHECK(action IN ('comment_create', 'profile_update', 'comment_report', 'comment_like')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Comment likes
  CREATE TABLE IF NOT EXISTS comment_likes (
    comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL CHECK(wallet_address = lower(wallet_address)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (comment_id, wallet_address)
  );

  CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);

  CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
    ON rate_limits(wallet_address, action, created_at);

  -- Shadowbans
  CREATE TABLE IF NOT EXISTS shadowbans (
    wallet_address TEXT PRIMARY KEY
      CHECK(wallet_address = lower(wallet_address)),
    banned_at TEXT NOT NULL DEFAULT (datetime('now')),
    banned_by TEXT NOT NULL,
    reason TEXT
  );
`);

// ---------- Idempotent migrations ----------

// Add auto_hidden_at to comments if missing
const hasAutoHidden = db.prepare(
  "SELECT name FROM pragma_table_info('comments') WHERE name = 'auto_hidden_at'"
).get();
if (!hasAutoHidden) {
  db.exec("ALTER TABLE comments ADD COLUMN auto_hidden_at TEXT");
  console.log("Migration: added auto_hidden_at to comments");
}

// Widen rate_limits CHECK constraint if it lacks comment_like
// SQLite can't alter CHECK constraints, so recreate if needed
const rlDDL = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='rate_limits'").get();
if (rlDDL && rlDDL.sql && !rlDDL.sql.includes('comment_like')) {
  db.pragma("foreign_keys = OFF");
  db.exec(`
    CREATE TABLE rate_limits_new (
      wallet_address TEXT NOT NULL,
      action TEXT NOT NULL
        CHECK(action IN ('comment_create', 'profile_update', 'comment_report', 'comment_like')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO rate_limits_new SELECT * FROM rate_limits;
    DROP TABLE rate_limits;
    ALTER TABLE rate_limits_new RENAME TO rate_limits;
    CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
      ON rate_limits(wallet_address, action, created_at);
  `);
  db.pragma("foreign_keys = ON");
  console.log("Migration: widened rate_limits CHECK to include comment_like");
}

export default db;
