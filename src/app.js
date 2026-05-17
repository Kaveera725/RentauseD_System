const express = require("express");
const session = require("express-session");
const path = require("path");
const { ROOT_DIR } = require("./config");
const { get } = require("./db");

const authRoutes = require("./routes/auth");
const itemRoutes = require("./routes/items");
const bookingRoutes = require("./routes/bookings");
const notificationRoutes = require("./routes/notifications");
const ownerRoutes = require("./routes/owner");
const adminRoutes = require("./routes/admin");

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(
    session({
      secret: "rentaused_dev_secret",
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true }
    })
  );

  app.use("/", express.static(path.join(ROOT_DIR, "public")));

  app.get("/api/me", (req, res) => {
    if (!req.session.userId) {
      res.json({ user: null });
      return;
    }
    const user = get("SELECT id, name, email, role, is_active FROM users WHERE id = ?", [req.session.userId]);
    if (!user || user.is_active === 0) {
      req.session.destroy(() => {
        res.json({ user: null });
      });
      return;
    }
    res.json({ user });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/items", itemRoutes);
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/owner", ownerRoutes);
  app.use("/api/admin", adminRoutes);

  return app;
}

module.exports = { createApp };
