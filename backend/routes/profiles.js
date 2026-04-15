import { Router } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// Magic bytes for image validation
const MAGIC = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  webp_riff: [0x52, 0x49, 0x46, 0x46], // RIFF header, check WEBP at offset 8
};

function validateImageBytes(buf) {
  if (!buf || buf.length < 12) return false;
  const b = buf;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return false;
}

const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

// ---------- GET /api/profiles/:wallet ----------
router.get("/:wallet", (req, res) => {
  const wallet = req.params.wallet.toLowerCase();
  const profile = db.prepare(
    "SELECT wallet_address, username, display_name, bio, avatar_url, created_at FROM profiles WHERE wallet_address = ?"
  ).get(wallet);
  if (!profile) {
    return res.status(404).json({ error: "Profile not found", code: "NOT_FOUND" });
  }
  res.json(profile);
});

// ---------- POST /api/profiles ----------
router.post("/", requireAuth, (req, res) => {
  const { username, display_name, bio } = req.body;

  if (!username || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: "Username must be 3-20 alphanumeric characters or underscores", code: "INVALID_USERNAME" });
  }
  if (display_name != null && display_name.length > 40) {
    return res.status(400).json({ error: "Display name must be 40 characters or less", code: "INVALID_DISPLAY_NAME" });
  }
  if (bio != null && bio.length > 160) {
    return res.status(400).json({ error: "Bio must be 160 characters or less", code: "INVALID_BIO" });
  }

  const existing = db.prepare("SELECT wallet_address FROM profiles WHERE wallet_address = ?").get(req.wallet);
  if (existing) {
    return res.status(409).json({ error: "Profile already exists", code: "ALREADY_EXISTS" });
  }

  const lower = username.toLowerCase();
  const taken = db.prepare("SELECT wallet_address FROM profiles WHERE username = ?").get(lower);
  if (taken) {
    return res.status(409).json({ error: "Username taken", code: "USERNAME_TAKEN" });
  }

  try {
    db.prepare(
      `INSERT INTO profiles (wallet_address, username, display_name, bio)
       VALUES (?, ?, ?, ?)`
    ).run(req.wallet, lower, display_name || null, bio || null);

    const profile = db.prepare(
      "SELECT wallet_address, username, display_name, bio, avatar_url, created_at, updated_at FROM profiles WHERE wallet_address = ?"
    ).get(req.wallet);
    res.status(201).json(profile);
  } catch (err) {
    if (err.message.includes("UNIQUE constraint")) {
      return res.status(409).json({ error: "Username taken", code: "USERNAME_TAKEN" });
    }
    console.error("Profile create error:", err.message);
    res.status(500).json({ error: "Failed to create profile" });
  }
});

// ---------- PATCH /api/profiles/me ----------
router.patch("/me", requireAuth, (req, res) => {
  const profile = db.prepare("SELECT * FROM profiles WHERE wallet_address = ?").get(req.wallet);
  if (!profile) {
    return res.status(404).json({ error: "Profile not found", code: "NOT_FOUND" });
  }

  const { username, display_name, bio } = req.body;
  const updates = [];
  const params = [];

  if (username !== undefined) {
    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({ error: "Username must be 3-20 alphanumeric characters or underscores", code: "INVALID_USERNAME" });
    }
    const lower = username.toLowerCase();
    if (lower !== profile.username) {
      // 30-day cooldown
      if (profile.username_changed_at) {
        const lastChange = new Date(profile.username_changed_at + "Z").getTime();
        const cooldownEnd = lastChange + 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        if (now < cooldownEnd) {
          const retrySeconds = Math.ceil((cooldownEnd - now) / 1000);
          return res.status(429).json({
            error: "Username can be changed once per 30 days",
            code: "COOLDOWN",
            retry_after_seconds: retrySeconds,
          });
        }
      }
      const taken = db.prepare("SELECT wallet_address FROM profiles WHERE username = ? AND wallet_address != ?").get(lower, req.wallet);
      if (taken) {
        return res.status(409).json({ error: "Username taken", code: "USERNAME_TAKEN" });
      }
      updates.push("username = ?", "username_changed_at = datetime('now')");
      params.push(lower);
    }
  }

  if (display_name !== undefined) {
    if (display_name !== null && display_name.length > 40) {
      return res.status(400).json({ error: "Display name must be 40 characters or less", code: "INVALID_DISPLAY_NAME" });
    }
    updates.push("display_name = ?");
    params.push(display_name || null);
  }

  if (bio !== undefined) {
    if (bio !== null && bio.length > 160) {
      return res.status(400).json({ error: "Bio must be 160 characters or less", code: "INVALID_BIO" });
    }
    updates.push("bio = ?");
    params.push(bio || null);
  }

  if (updates.length === 0) {
    return res.json(profile);
  }

  updates.push("updated_at = datetime('now')");
  params.push(req.wallet);

  try {
    db.prepare(`UPDATE profiles SET ${updates.join(", ")} WHERE wallet_address = ?`).run(...params);
    const updated = db.prepare(
      "SELECT wallet_address, username, display_name, bio, avatar_url, created_at, updated_at FROM profiles WHERE wallet_address = ?"
    ).get(req.wallet);
    res.json(updated);
  } catch (err) {
    if (err.message.includes("UNIQUE constraint")) {
      return res.status(409).json({ error: "Username taken", code: "USERNAME_TAKEN" });
    }
    console.error("Profile update error:", err.message);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ---------- POST /api/profiles/me/avatar ----------
router.post("/me/avatar", requireAuth, upload.single("avatar"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded", code: "NO_FILE" });
  }

  // Validate mime
  if (!ALLOWED_MIMES.has(req.file.mimetype)) {
    return res.status(400).json({ error: "Only JPEG, PNG, and WebP images are allowed", code: "INVALID_TYPE" });
  }

  // Validate magic bytes
  const detectedType = validateImageBytes(req.file.buffer);
  if (!detectedType) {
    return res.status(400).json({ error: "File is not a valid image", code: "INVALID_TYPE" });
  }

  const profile = db.prepare("SELECT wallet_address FROM profiles WHERE wallet_address = ?").get(req.wallet);
  if (!profile) {
    return res.status(404).json({ error: "Profile not found. Create a profile first.", code: "NOT_FOUND" });
  }

  if (!process.env.CLOUDINARY_URL) {
    return res.status(503).json({ error: "Avatar upload not configured" });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "opick/avatars",
          public_id: req.wallet,
          overwrite: true,
          transformation: [{ width: 400, height: 400, crop: "fill", fetch_format: "auto", quality: "auto" }],
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    db.prepare("UPDATE profiles SET avatar_url = ?, updated_at = datetime('now') WHERE wallet_address = ?")
      .run(result.secure_url, req.wallet);

    res.json({ avatar_url: result.secure_url });
  } catch (err) {
    console.error("Avatar upload error:", err.message);
    res.status(500).json({ error: "Failed to upload avatar" });
  }
});

export default router;
