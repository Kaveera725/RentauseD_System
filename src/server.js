const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const multer = require("multer");
const initSqlJs = require("sql.js");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const DB_PATH = path.join(DATA_DIR, "rentaused.db");
const UPLOAD_DIR = path.join(ROOT_DIR, "public", "uploads");

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

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}_${safeName}`);
    }
  }),
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image uploads are allowed"));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

let db;

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  saveDb();
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0] || null;
}

function createSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price_per_day REAL NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      image_path TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      rejection_reason TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      renter_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      rejection_reason TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES items(id),
      FOREIGN KEY (renter_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      reviewer_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (item_id, reviewer_id),
      FOREIGN KEY (item_id) REFERENCES items(id),
      FOREIGN KEY (reviewer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
}

async function ensureAdmin() {
  const existing = get("SELECT id FROM users WHERE role = ?", ["admin"]);
  if (existing) {
    return;
  }
  const passwordHash = await bcrypt.hash("admin123", 10);
  run(
    "INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
    ["Admin", "admin@local", passwordHash, "admin", new Date().toISOString()]
  );
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Authentication required" });
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

function createNotification(userId, message) {
  run(
    "INSERT INTO notifications (user_id, message, is_read, created_at) VALUES (?, ?, 0, ?)",
    [userId, message, new Date().toISOString()]
  );
}

app.post("/api/auth/register", async (req, res) => {
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

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = get("SELECT id, password_hash, role, name FROM users WHERE email = ?", [email]);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
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

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/me", (req, res) => {
  if (!req.session.userId) {
    res.json({ user: null });
    return;
  }
  const user = get("SELECT id, name, email, role FROM users WHERE id = ?", [req.session.userId]);
  res.json({ user });
});

app.get("/api/items", (_req, res) => {
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

app.post("/api/items", requireAuth, upload.single("image"), (req, res) => {
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

app.get("/api/bookings/my", requireAuth, (req, res) => {
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

app.post("/api/bookings", requireAuth, (req, res) => {
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
      `New booking request for "${item.title}" is pending admin approval.`
    );
  }
  res.json({ ok: true });
});

app.post("/api/reviews", requireAuth, (req, res) => {
  const { itemId, rating, comment } = req.body;
  if (!itemId || !rating || !comment) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  try {
    run(
      `
      INSERT INTO reviews (item_id, reviewer_id, rating, comment, created_at)
      VALUES (?, ?, ?, ?, ?)
      `,
      [Number(itemId), req.session.userId, Number(rating), comment, new Date().toISOString()]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: "You already reviewed this item." });
  }
});

app.get("/api/notifications", requireAuth, (req, res) => {
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

app.get("/api/owner/dashboard", requireAuth, (req, res) => {
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

app.get("/api/admin/items", requireAuth, requireAdmin, (_req, res) => {
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

app.post("/api/admin/items/:id/approve", requireAuth, requireAdmin, (req, res) => {
  const { approved, reason } = req.body;
  const itemId = Number(req.params.id);
  const item = get("SELECT owner_id, title FROM items WHERE id = ?", [itemId]);
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  if (approved) {
    run("UPDATE items SET status = 'approved', rejection_reason = NULL WHERE id = ?", [itemId]);
    createNotification(item.owner_id, `Your item "${item.title}" was approved.`);
  } else {
    run("UPDATE items SET status = 'rejected', rejection_reason = ? WHERE id = ?", [reason || "", itemId]);
    createNotification(item.owner_id, `Your item "${item.title}" was rejected. ${reason || ""}`);
  }
  res.json({ ok: true });
});

app.get("/api/admin/bookings", requireAuth, requireAdmin, (_req, res) => {
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

app.post("/api/admin/bookings/:id/approve", requireAuth, requireAdmin, (req, res) => {
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
    createNotification(booking.renter_id, `Your booking for "${item?.title || "item"}" was approved.`);
  } else {
    run("UPDATE bookings SET status = 'rejected', rejection_reason = ? WHERE id = ?", [reason || "", bookingId]);
    createNotification(booking.renter_id, `Your booking was rejected. ${reason || ""}`);
  }
  res.json({ ok: true });
});

app.get("/api/admin/stats", requireAuth, requireAdmin, (_req, res) => {
  const users = get("SELECT COUNT(*) AS total FROM users");
  const items = get("SELECT COUNT(*) AS total FROM items");
  const bookings = get("SELECT COUNT(*) AS total FROM bookings");
  res.json({
    users: users?.total || 0,
    items: items?.total || 0,
    bookings: bookings?.total || 0
  });
});

async function start() {
  ensureDirs();
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(ROOT_DIR, "node_modules", "sql.js", "dist", file)
  });
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    createSchema();
    saveDb();
  }
  createSchema();
  await ensureAdmin();

  app.listen(PORT, () => {
    console.log(`RentauseD running on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
