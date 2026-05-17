const bcrypt = require("bcrypt");
const { PORT } = require("./config");
const { ensureStorage } = require("./storage");
const { initDb, get, run } = require("./db");
const { createApp } = require("./app");

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

async function start() {
  ensureStorage();
  await initDb();
  await ensureAdmin();

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`RentauseD running on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
