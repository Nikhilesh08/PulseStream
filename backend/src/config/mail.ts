import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true, // Use true for port 465, false for port 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async (
  to: string,
  subject: string,
  htmlContent: string,
): Promise<boolean> => {
  try {
    const info = await transporter.sendMail({
      from: `"PulseStream Alerts" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: htmlContent,
    });
    console.log(`📧 [Nodemailer]: Sent email to ${to} (ID: ${info.messageId})`);
    return true;
  } catch (error: any) {
    console.error(`❌ [Nodemailer]: Failed to send to ${to}:`, error.message);
    throw error; // Throw so BullMQ marks the job as failed and triggers a retry!
  }
};
