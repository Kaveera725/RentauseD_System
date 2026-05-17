const express = require("express");
const bcrypt = require("bcrypt");
const { run, get } = require("../db");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const existing = get("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const userRole = role === "owner" ? "owner" : "user";
  run(
    "INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
    [name, email, passwordHash, userRole, new Date().toISOString()]
  );
  res.json({ ok: true });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = get(
    "SELECT id, password_hash, role, name, is_active FROM users WHERE email = ?",
    [email]
  );
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (user.is_active === 0) {
    res.status(403).json({ error: "Account is deactivated" });
    return;
  }
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  req.session.userId = user.id;
  res.json({ ok: true, role: user.role, name: user.name });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/me", (req, res) => {
  if (!req.session.userId) {
    res.json({ user: null });
    return;
  }
  const user = get("SELECT id, name, email, role FROM users WHERE id = ?", [req.session.userId]);
  res.json({ user });
});

module.exports = router;
