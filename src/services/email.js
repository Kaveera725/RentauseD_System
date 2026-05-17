const nodemailer = require("nodemailer");
const { SMTP_HOST, SMTP_PORT, SMTP_FROM, SMTP_ENABLED } = require("../config");

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false
    });
  }
  return transporter;
}

async function sendEmail(to, subject, text) {
  if (!SMTP_ENABLED) {
    return;
  }
  const mailer = getTransporter();
  await mailer.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text
  });
}

async function verifyEmailConnection() {
  if (!SMTP_ENABLED) {
    return { enabled: false, ok: true, message: "SMTP disabled" };
  }
  const mailer = getTransporter();
  await mailer.verify();
  return { enabled: true, ok: true, message: "SMTP connection ok" };
}

module.exports = { sendEmail, verifyEmailConnection };
