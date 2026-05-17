const express = require("express");
const { run, all } = require("../db");
const { requireAuth } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

router.get("/", (_req, res) => {
  const items = all(
    `
    SELECT items.*, users.name AS owner_name
    FROM items
    JOIN users ON users.id = items.owner_id
    WHERE items.status = 'approved'
    ORDER BY items.created_at DESC
    `
  );
  res.json({ items });
});

router.post("/", requireAuth, upload.single("image"), (req, res) => {
  const { title, description, pricePerDay, category, location } = req.body;
  if (!title || !description || !pricePerDay || !category || !location) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  run(
    `
    INSERT INTO items (owner_id, title, description, price_per_day, category, location, image_path, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `,
    [
      req.session.userId,
      title,
      description,
      Number(pricePerDay),
      category,
      location,
      imagePath,
      new Date().toISOString()
    ]
  );
  res.json({ ok: true });
});

module.exports = router;
