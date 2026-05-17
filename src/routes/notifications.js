const express = require("express");
const { all } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  const notifications = all(
    `
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    `,
    [req.session.userId]
  );
  res.json({ notifications });
});

module.exports = router;
