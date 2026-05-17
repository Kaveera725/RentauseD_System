const { run, get } = require("../db");
const { sendEmail } = require("./email");

function createNotification(userId, message, subject = "RentauseD update") {
  run(
    "INSERT INTO notifications (user_id, message, is_read, created_at) VALUES (?, ?, 0, ?)",
    [userId, message, new Date().toISOString()]
  );

  const user = get("SELECT email FROM users WHERE id = ?", [userId]);
  if (user && user.email) {
    sendEmail(user.email, subject, message).catch((error) => {
      console.warn("Email delivery failed", error.message);
    });
  }
}

module.exports = { createNotification };
