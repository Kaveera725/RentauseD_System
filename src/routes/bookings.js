const express = require("express");
const { run, all, get } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { createNotification } = require("../services/notifications");

const router = express.Router();

router.get("/my", requireAuth, (req, res) => {
  const bookings = all(
    `
    SELECT bookings.*, items.title AS item_title
    FROM bookings
    JOIN items ON items.id = bookings.item_id
    WHERE bookings.renter_id = ?
    ORDER BY bookings.created_at DESC
    `,
    [req.session.userId]
  );
  res.json({ bookings });
});

router.post("/", requireAuth, (req, res) => {
  const { itemId, startDate, endDate } = req.body;
  if (!itemId || !startDate || !endDate) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  if (startDate > endDate) {
    res.status(400).json({ error: "Start date must be before end date" });
    return;
  }
  const conflictingBooking = get(
    `
    SELECT id
    FROM bookings
    WHERE item_id = ?
      AND status = 'approved'
      AND NOT (end_date < ? OR start_date > ?)
    `,
    [Number(itemId), startDate, endDate]
  );
  if (conflictingBooking) {
    res.status(409).json({ error: "Selected dates overlap an existing booking" });
    return;
  }
  run(
    `
    INSERT INTO bookings (item_id, renter_id, start_date, end_date, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
    `,
    [Number(itemId), req.session.userId, startDate, endDate, new Date().toISOString()]
  );
  const item = get("SELECT owner_id, title FROM items WHERE id = ?", [Number(itemId)]);
  if (item) {
    createNotification(
      item.owner_id,
      `New booking request for "${item.title}" is pending admin approval.`,
      "New booking request"
    );
  }
  res.json({ ok: true });
});

module.exports = router;
