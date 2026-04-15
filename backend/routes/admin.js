import { Router } from "express";
import db from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

// ---------- GET /api/admin/reports ----------
router.get("/reports", requireAdmin, (req, res) => {
  try {
    const reports = db.prepare(`
      SELECT cr.id, cr.comment_id, cr.reporter_wallet, cr.reason, cr.created_at,
             c.body AS comment_body, c.market_address, c.author_wallet,
             p.username AS author_username, p.display_name AS author_display_name
      FROM comment_reports cr
      JOIN comments c ON cr.comment_id = c.id
      LEFT JOIN profiles p ON c.author_wallet = p.wallet_address
      WHERE cr.resolved_at IS NULL
      ORDER BY cr.created_at DESC
      LIMIT 100
    `).all();
    res.json({ reports });
  } catch (err) {
    console.error("Admin reports error:", err.message);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// ---------- POST /api/admin/comments/:id/delete ----------
router.post("/comments/:id/delete", requireAdmin, (req, res) => {
  const comment = db.prepare("SELECT id, deleted_at FROM comments WHERE id = ?").get(req.params.id);
  if (!comment) {
    return res.status(404).json({ error: "Comment not found", code: "NOT_FOUND" });
  }

  db.prepare(
    "UPDATE comments SET deleted_at = datetime('now'), deleted_by = 'admin' WHERE id = ?"
  ).run(req.params.id);

  // Resolve all open reports for this comment
  db.prepare(
    "UPDATE comment_reports SET resolved_at = datetime('now') WHERE comment_id = ? AND resolved_at IS NULL"
  ).run(req.params.id);

  res.status(204).end();
});

// ---------- POST /api/admin/reports/:id/dismiss ----------
router.post("/reports/:id/dismiss", requireAdmin, (req, res) => {
  const report = db.prepare("SELECT id, resolved_at FROM comment_reports WHERE id = ?").get(req.params.id);
  if (!report) {
    return res.status(404).json({ error: "Report not found", code: "NOT_FOUND" });
  }
  if (report.resolved_at) {
    return res.status(409).json({ error: "Report already resolved", code: "ALREADY_RESOLVED" });
  }

  db.prepare(
    "UPDATE comment_reports SET resolved_at = datetime('now') WHERE id = ?"
  ).run(req.params.id);

  res.status(204).end();
});

// ---------- POST /api/admin/wallets/:wallet/shadowban ----------
router.post("/wallets/:wallet/shadowban", requireAdmin, (req, res) => {
  const wallet = req.params.wallet.toLowerCase();
  const { reason } = req.body || {};

  const existing = db.prepare("SELECT wallet_address FROM shadowbans WHERE wallet_address = ?").get(wallet);
  if (existing) {
    return res.status(409).json({ error: "Already shadowbanned", code: "ALREADY_BANNED" });
  }

  try {
    db.prepare(
      "INSERT INTO shadowbans (wallet_address, banned_by, reason) VALUES (?, ?, ?)"
    ).run(wallet, req.wallet, reason || null);
    res.status(201).json({ wallet_address: wallet, banned_by: req.wallet });
  } catch (err) {
    console.error("Shadowban error:", err.message);
    res.status(500).json({ error: "Failed to shadowban" });
  }
});

// ---------- DELETE /api/admin/wallets/:wallet/shadowban ----------
router.delete("/wallets/:wallet/shadowban", requireAdmin, (req, res) => {
  const wallet = req.params.wallet.toLowerCase();
  const result = db.prepare("DELETE FROM shadowbans WHERE wallet_address = ?").run(wallet);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Not shadowbanned", code: "NOT_FOUND" });
  }
  res.status(204).end();
});

export default router;
