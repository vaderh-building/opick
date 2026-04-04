import { Router } from "express";
import db from "../db.js";

const router = Router();

// GET /api/users/:address
router.get("/:address", (req, res) => {
  try {
    const user = db
      .prepare("SELECT * FROM users WHERE address = ?")
      .get(req.params.address);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error.message);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// PUT /api/users/:address
router.put("/:address", (req, res) => {
  try {
    const { username, avatarUrl } = req.body;
    const address = req.params.address;

    if (!username) {
      return res.status(400).json({ error: "username is required" });
    }

    db.prepare(
      `INSERT INTO users (address, username, avatar_url)
       VALUES (?, ?, ?)
       ON CONFLICT(address) DO UPDATE SET
         username = excluded.username,
         avatar_url = excluded.avatar_url`
    ).run(address, username, avatarUrl || null);

    const user = db
      .prepare("SELECT * FROM users WHERE address = ?")
      .get(address);

    res.json(user);
  } catch (error) {
    console.error("Error upserting user:", error.message);
    res.status(500).json({ error: "Failed to update user" });
  }
});

export default router;
