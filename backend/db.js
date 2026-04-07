import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "opick.db");
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market_address TEXT NOT NULL,
    user_address TEXT NOT NULL,
    text TEXT NOT NULL,
    parent_id INTEGER,
    likes INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    address TEXT PRIMARY KEY,
    username TEXT,
    avatar_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comment_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    user_address TEXT NOT NULL,
    UNIQUE(comment_id, user_address)
  );

  CREATE INDEX IF NOT EXISTS idx_comments_market ON comments(market_address);
  CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);

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
`);

export default db;
