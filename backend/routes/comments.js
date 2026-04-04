import { Router } from "express";
import db from "../db.js";

const router = Router();

// GET /api/comments/:marketAddress
router.get("/:marketAddress", (req, res) => {
  try {
    const comments = db
      .prepare(
        "SELECT * FROM comments WHERE market_address = ? ORDER BY created_at DESC"
      )
      .all(req.params.marketAddress);

    res.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error.message);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// POST /api/comments
router.post("/", (req, res) => {
  try {
    const { marketAddress, userAddress, text, parentId } = req.body;

    if (!marketAddress || !userAddress || !text) {
      return res
        .status(400)
        .json({ error: "marketAddress, userAddress, and text are required" });
    }

    const result = db
      .prepare(
        "INSERT INTO comments (market_address, user_address, text, parent_id) VALUES (?, ?, ?, ?)"
      )
      .run(marketAddress, userAddress, text, parentId || null);

    const comment = db
      .prepare("SELECT * FROM comments WHERE id = ?")
      .get(result.lastInsertRowid);

    res.status(201).json(comment);
  } catch (error) {
    console.error("Error creating comment:", error.message);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

// POST /api/comments/:id/like
router.post("/:id/like", (req, res) => {
  try {
    const { userAddress } = req.body;
    const commentId = req.params.id;

    if (!userAddress) {
      return res.status(400).json({ error: "userAddress is required" });
    }

    const existing = db
      .prepare(
        "SELECT id FROM comment_likes WHERE comment_id = ? AND user_address = ?"
      )
      .get(commentId, userAddress);

    if (existing) {
      // Unlike: remove the like
      db.prepare(
        "DELETE FROM comment_likes WHERE comment_id = ? AND user_address = ?"
      ).run(commentId, userAddress);
      db.prepare("UPDATE comments SET likes = likes - 1 WHERE id = ?").run(
        commentId
      );
    } else {
      // Like: add the like
      db.prepare(
        "INSERT INTO comment_likes (comment_id, user_address) VALUES (?, ?)"
      ).run(commentId, userAddress);
      db.prepare("UPDATE comments SET likes = likes + 1 WHERE id = ?").run(
        commentId
      );
    }

    const comment = db
      .prepare("SELECT * FROM comments WHERE id = ?")
      .get(commentId);

    res.json(comment);
  } catch (error) {
    console.error("Error toggling like:", error.message);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

export default router;
