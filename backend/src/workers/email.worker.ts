import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { sendEmail } from "../config/mail";
import User from "../models/User";
import { Delivery } from "../models/Delivery";

export const emailWorker = new Worker(
  "email-queue",
  async (job: Job) => {
    const { eventId, userId, subject, payload } = job.data;
    console.log(`📧 Email Worker: Picking up job for User ID ${userId}`);

    const user = await User.findById(userId);
    if (!user) {
      console.error(
        `Email Worker: User ID ${userId} not found in MongoDB! Skipping.`,
      );

      //  THE SAFETY NET: Prevents "Ghost Receipts" sitting in "pending" forever
      if (eventId) {
        await Delivery.findOneAndUpdate(
          { eventId: eventId, userId: userId, channel: "email" },
          {
            status: "failed",
            errorMessage: "User account was deleted from database.",
            faultType: "ORPHANED_USER",
          },
        );
      }
      return;
    }

    const productName = payload?.productName || "Your Watched Item";
    const oldPrice = payload?.oldPrice || "N/A";
    const newPrice = payload?.newPrice || "N/A";

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>PulseStream Watchlist Update</title>
    </head>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 0;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background-color: #0f172a; padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">PulseStream<span style="color: #3b82f6;">.io</span></h1>
        </div>
        <div style="padding: 40px 32px;">
          <p style="font-size: 16px; color: #475569; margin-top: 0;">Hello <strong style="color: #0f172a;">${user.name}</strong>,</p>
          <p style="font-size: 16px; color: #475569; line-height: 1.5;">This is an automated notification that an item on your PulseStream watchlist has recorded a price change.</p>
          <div style="margin: 32px 0; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; background-color: #f8fafc; border-left: 4px solid #4f46e5;">
            <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #0f172a;">${productName}</h2>
            <div style="display: block; margin-top: 8px;">
              <span style="font-size: 28px; font-weight: 800; color: #10b981;">$${newPrice}</span>
              <span style="font-size: 16px; color: #94a3b8; text-decoration: line-through; margin-left: 12px;">$${oldPrice}</span>
            </div>
          </div>
          <p style="font-size: 14px; color: #64748b;">You can review your active subscriptions and manage notification channels anytime from your account preferences.</p>
          <div style="text-align: center; margin-top: 32px;">
            <a href="http://localhost:5173" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">View Watchlist</a>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">You are receiving this automated update because you opted into email notifications on PulseStream.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    try {
      const cleanSubject =
        subject || `Watchlist Update: New price recorded for ${productName}`;

      await sendEmail(user.email, cleanSubject, html);
      console.log(`✅ Email Worker: Delivered to ${user.email}`);

      // Updates dashboard to "success"
      if (eventId) {
        await Delivery.findOneAndUpdate(
          { eventId: eventId, userId: user._id, channel: "email" },
          { status: "success", sentAt: new Date() },
        );
      }
    } catch (error: any) {
      console.error(`❌ Email Worker Failed for ${user.email}:`, error.message);

      // Marks dashboard as "failed"
      if (eventId) {
        await Delivery.findOneAndUpdate(
          { eventId: eventId, userId: user._id, channel: "email" },
          {
            status: "failed",
            errorMessage: error.message,
            faultType: "SMTP_DELIVERY_ERROR",
          },
        );
      }
      throw error;
    }
  },
  { connection: redisConnection },
);
