const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: smtpConfigured
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

if (!smtpConfigured) {
  console.warn(
    "⚠️ SMTP is not configured. In-app notifications will work, but email jobs will fail until SMTP_USER and SMTP_PASS are set.",
  );
}

const sendEmail = async (to, subject, htmlContent) => {
  if (!smtpConfigured) {
    throw new Error("SMTP_USER and SMTP_PASS are required for email delivery");
  }

  const info = await transporter.sendMail({
    from: `"PulseStream Alerts" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html: htmlContent,
  });

  console.log(`📧 Email sent to ${to} (${info.messageId})`);
  return true;
};

module.exports = { sendEmail };
