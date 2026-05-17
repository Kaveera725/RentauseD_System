const { get } = require("../db");

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const user = get("SELECT is_active FROM users WHERE id = ?", [req.session.userId]);
  if (!user || user.is_active === 0) {
    req.session.destroy(() => {
      res.status(403).json({ error: "Account is deactivated" });
    });
    return;
  }
  next();
}

function requireAdmin(req, res, next) {
  const user = get("SELECT role FROM users WHERE id = ?", [req.session.userId]);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
