import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

// Dedicated queue for real-time website alerts
export const inAppQueue = new Queue("inapp-queue", {
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

console.log('📦 BullMQ "inapp-queue" is ready for real-time alerts!');
