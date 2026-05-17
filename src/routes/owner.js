const express = require("express");
const { all } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/dashboard", requireAuth, (req, res) => {
  const items = all(
    `
    SELECT id, title, status, rejection_reason, created_at
    FROM items
    WHERE owner_id = ?
    ORDER BY created_at DESC
    `,
    [req.session.userId]
  );
  const bookings = all(
    `
    SELECT bookings.*, items.title AS item_title, users.name AS renter_name
    FROM bookings
    JOIN items ON items.id = bookings.item_id
    JOIN users ON users.id = bookings.renter_id
    WHERE items.owner_id = ?
    ORDER BY bookings.created_at DESC
    `,
    [req.session.userId]
  );
  res.json({ items, bookings });
});

module.exports = router;
