import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { getIO } from "../config/socket";
import User from "../models/User"; // <-- Robust default import!

export const inAppWorker = new Worker(
  "inapp-queue",
  async (job: Job) => {
    const { userId, message, payload } = job.data;
    console.log(
      `⚡ [In-App Worker]: Processing instant push for User ID "${userId}"`,
    );

    const user = await User.findById(userId);
    if (!user) {
      console.error(
        `❌ [In-App Worker]: User ID "${userId}" not found in MongoDB! Skipping.`,
      );
      return;
    }

    try {
      const io = getIO();
      // Emit live WebSocket event directly to this specific user's socket channel!
      io.to(userId).emit("new_notification", {
        message,
        payload,
        timestamp: new Date(),
      });
      console.log(
        `✅ [In-App Worker]: SUCCESS! Beamed live WebSocket toast to ${user.name} (${userId})`,
      );
    } catch (err: any) {
      console.error(`❌ [In-App Worker]: Socket emission failed:`, err.message);
    }
  },
  { connection: redisConnection },
);
