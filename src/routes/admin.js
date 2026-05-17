const express = require("express");
const { run, all, get } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { createNotification } = require("../services/notifications");
const { verifyEmailConnection } = require("../services/email");

const router = express.Router();

router.get("/items", requireAuth, requireAdmin, (_req, res) => {
  const items = all(
    `
    SELECT items.*, users.name AS owner_name
    FROM items
    JOIN users ON users.id = items.owner_id
    WHERE items.status = 'pending'
    ORDER BY items.created_at DESC
    `
  );
  res.json({ items });
});

router.post("/items/:id/approve", requireAuth, requireAdmin, (req, res) => {
  const { approved, reason } = req.body;
  const itemId = Number(req.params.id);
  const item = get("SELECT owner_id, title FROM items WHERE id = ?", [itemId]);
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  if (approved) {
    run("UPDATE items SET status = 'approved', rejection_reason = NULL WHERE id = ?", [itemId]);
    createNotification(item.owner_id, `Your item "${item.title}" was approved.`, "Item approved");
  } else {
    run("UPDATE items SET status = 'rejected', rejection_reason = ? WHERE id = ?", [reason || "", itemId]);
    createNotification(
      item.owner_id,
      `Your item "${item.title}" was rejected. ${reason || ""}`,
      "Item rejected"
    );
  }
  res.json({ ok: true });
});

router.get("/bookings", requireAuth, requireAdmin, (_req, res) => {
  const bookings = all(
    `
    SELECT bookings.*, items.title AS item_title, users.name AS renter_name
    FROM bookings
    JOIN items ON items.id = bookings.item_id
    JOIN users ON users.id = bookings.renter_id
    WHERE bookings.status = 'pending'
    ORDER BY bookings.created_at DESC
    `
  );
  res.json({ bookings });
});

router.post("/bookings/:id/approve", requireAuth, requireAdmin, (req, res) => {
  const { approved, reason } = req.body;
  const bookingId = Number(req.params.id);
  const booking = get(
    "SELECT renter_id, item_id, start_date, end_date FROM bookings WHERE id = ?",
    [bookingId]
  );
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  if (approved) {
    const conflict = get(
      `
      SELECT id
      FROM bookings
      WHERE item_id = ?
        AND status = 'approved'
        AND id <> ?
        AND NOT (end_date < ? OR start_date > ?)
      `,
      [booking.item_id, bookingId, booking.start_date, booking.end_date]
    );
    if (conflict) {
      res.status(409).json({ error: "Booking conflicts with an approved rental" });
      return;
    }
    run("UPDATE bookings SET status = 'approved', rejection_reason = NULL WHERE id = ?", [bookingId]);
    const item = get("SELECT title FROM items WHERE id = ?", [booking.item_id]);
    createNotification(
      booking.renter_id,
      `Your booking for "${item?.title || "item"}" was approved.`,
      "Booking approved"
    );
  } else {
    run("UPDATE bookings SET status = 'rejected', rejection_reason = ? WHERE id = ?", [reason || "", bookingId]);
    createNotification(booking.renter_id, `Your booking was rejected. ${reason || ""}`, "Booking rejected");
  }
  res.json({ ok: true });
});

router.get("/stats", requireAuth, requireAdmin, (_req, res) => {
  const users = get("SELECT COUNT(*) AS total FROM users");
  const items = get("SELECT COUNT(*) AS total FROM items");
  const bookings = get("SELECT COUNT(*) AS total FROM bookings");
  res.json({
    users: users?.total || 0,
    items: items?.total || 0,
    bookings: bookings?.total || 0
  });
});

router.get("/users", requireAuth, requireAdmin, (_req, res) => {
  const users = all(
    "SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC"
  );
  res.json({ users });
});

router.post("/users/:id/deactivate", requireAuth, requireAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  if (targetId === req.session.userId) {
    res.status(400).json({ error: "Cannot deactivate your own account" });
    return;
  }
  const target = get("SELECT id, role FROM users WHERE id = ?", [targetId]);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (target.role === "admin") {
    res.status(400).json({ error: "Cannot deactivate an admin account" });
    return;
  }
  run("UPDATE users SET is_active = 0 WHERE id = ?", [targetId]);
  res.json({ ok: true });
});

router.post("/users/:id/reactivate", requireAuth, requireAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  run("UPDATE users SET is_active = 1 WHERE id = ?", [targetId]);
  res.json({ ok: true });
});

router.get("/smtp/health", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const status = await verifyEmailConnection();
    res.json(status);
  } catch (error) {
    res.status(503).json({ enabled: true, ok: false, message: error.message });
  }
});

module.exports = router;
