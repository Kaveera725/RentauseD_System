const path = require("path");
require("dotenv").config();

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const DB_PATH = path.join(DATA_DIR, "rentaused.db");
const UPLOAD_DIR = path.join(ROOT_DIR, "public", "uploads");
const PORT = process.env.PORT || 3000;

const SMTP_HOST = process.env.SMTP_HOST || "localhost";
const SMTP_PORT = Number(process.env.SMTP_PORT || 1025);
const SMTP_FROM = process.env.SMTP_FROM || "no-reply@rentaused.local";
const SMTP_ENABLED = process.env.SMTP_ENABLED !== "false";

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  DB_PATH,
  UPLOAD_DIR,
  PORT,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_FROM,
  SMTP_ENABLED
};
