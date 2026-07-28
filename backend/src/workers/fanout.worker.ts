import { Queue, Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { Follow } from "../models/Follow";
import { emailQueue } from "../queues/email.queue";
import { inAppQueue } from "../queues/inapp.queue"; // ✅ Fixed: Capital "A"

// Instantiate our primary fan-out queue using our existing Upstash Redis connection
export const fanoutQueue = new Queue("fanout-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

console.log('📦 BullMQ "fanout-queue" is ready to receive jobs!');

// The Worker that actually processes the background jobs
export const fanoutWorker = new Worker(
  "fanout-queue",
  async (job: Job) => {
    const { eventId, topicId, type, payload } = job.data;
    console.log(`[Fanout Worker] Processing event for topic: ${topicId}`);

    // Search the Follow collection using the STRING topicId
    const followers = await Follow.find({ topicId: String(topicId) }).lean();

    console.log(`[Fanout Worker] Found ${followers.length} active followers!`);

    // Route the payloads to the correct notification queues
    for (const follower of followers) {
      if (follower.channels.includes("email")) {
        await emailQueue.add("send-email", {
          userId: follower.userId,
          type,
          payload,
        });
      }

      if (follower.channels.includes("inApp")) {
        await inAppQueue.add("send-inapp", {
          // ✅ Fixed: Capital "A"
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
