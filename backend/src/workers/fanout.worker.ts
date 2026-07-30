import { Queue, Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { Follow } from "../models/Follow";
import { Delivery } from "../models/Delivery";
import User from "../models/User"; // 🚀 ADDED: Import User model to verify followers
import { emailQueue } from "../queues/email.queue";
import { inAppQueue } from "../queues/inapp.queue";

export const fanoutQueue = new Queue("fanout-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

console.log('📦 BullMQ "fanout-queue" is ready to receive jobs!');

export const fanoutWorker = new Worker(
  "fanout-queue",
  async (job: Job) => {
    const { eventId, topicId, type, payload } = job.data;
    console.log(`[Fanout Worker] Processing event for topic: ${topicId}`);

    const followers = await Follow.find({ topicId: String(topicId) }).lean();
    console.log(`[Fanout Worker] Found ${followers.length} active followers!`);

    for (const follower of followers) {
      // 🚀 THE BOUNCER: Check if the user actually still exists in MongoDB!
      const userExists = await User.exists({ _id: follower.userId });
      if (!userExists) {
        console.warn(
          `🧹 [Fanout Worker]: Found orphaned follow for deleted User ID ${follower.userId}. Auto-cleaning...`,
        );
        await Follow.deleteMany({ userId: follower.userId }); // Automatically deletes the ghost subscription!
        continue; // Skips creating any jobs or Delivery receipts for this deleted user!
      }

      // --- 1. EMAIL CHANNEL ---
      if (follower.channels.includes("email")) {
        try {
          if (eventId) {
            await Delivery.findOneAndUpdate(
              { eventId: eventId, userId: follower.userId, channel: "email" },
              { status: "pending", attempts: 0 },
              { upsert: true, new: true },
            );
          }
        } catch (dbErr) {
          console.error(
            "Failed to create pending email delivery record:",
            dbErr,
          );
        }

        await emailQueue.add("send-email", {
          eventId,
          userId: follower.userId,
          type,
          payload,
        });
      }

      // --- 2. IN-APP CHANNEL ---
      if (follower.channels.includes("inApp")) {
        try {
          if (eventId) {
            await Delivery.findOneAndUpdate(
              { eventId: eventId, userId: follower.userId, channel: "inApp" },
              { status: "pending", attempts: 0 },
              { upsert: true, new: true },
            );
          }
        } catch (dbErr) {
          console.error(
            "Failed to create pending inApp delivery record:",
            dbErr,
          );
        }

        await inAppQueue.add("send-inapp", {
          eventId,
          userId: follower.userId,
          type,
          payload,
        });
      }
    }
  },
  { connection: redisConnection },
);

fanoutWorker.on("failed", (job, err) => {
  console.error(`❌ [Fanout Worker] Job ${job?.id} failed:`, err.message);
});
