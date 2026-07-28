import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { sendEmail } from "../config/mail";
import User from "../models/User";

export const emailWorker = new Worker(
  "email-queue",
  async (job: Job) => {
    const { userId, subject, productName, oldPrice, newPrice } = job.data;
    console.log(`📧 Email Worker: Picking up job for User ID ${userId}`);

    const user = await User.findById(userId);
    if (!user) {
      console.error(
        `Email Worker: User ID ${userId} not found in MongoDB! Skipping.`,
      );
      return;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color:#4F46E5;">Price Drop Alert!</h2>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>Good news! An item on your PulseStream watchlist just went on sale.</p>
        <div style="background:#f8fafc; padding:15px; border-radius:8px; margin:20px 0;">
          <h3 style="margin:0; color:#1e293b;">${productName}</h3>
          <p style="font-size:18px; margin:10px 0 0 0;">
            New Price: <strong style="color:#10b981;">${newPrice}</strong>
            <span style="text-decoration:line-through; color:#64748b; font-size:14px;">${oldPrice}</span>
          </p>
        </div>
        <p style="font-size:12px; color:#94a3b8;">
          You received this because you opted into email alerts on your Shopper Portal.
        </p>
      </div>
    `;

    // sendEmail throws on failure, which BullMQ catches to trigger the configured retry/backoff.
    await sendEmail(user.email, subject, html);
    console.log(`✅ Email Worker: Delivered to ${user.email}`);
  },
  { connection: redisConnection },
);
