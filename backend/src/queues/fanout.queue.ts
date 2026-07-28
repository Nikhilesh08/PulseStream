import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

// Instantiate our primary fan-out queue using our existing Upstash Redis connection
export const fanoutQueue = new Queue("fanout-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry automatically up to 3 times if something crashes
    backoff: {
      type: "exponential",
      delay: 1000, // Wait 1s, then 2s, then 4s between retries
    },
    removeOnComplete: true, // Keep Redis clean by deleting finished jobs
    removeOnFail: false, // Keep failed jobs in Redis so we can debug them later
  },
});

console.log('📦 BullMQ "fanout-queue" is ready to receive jobs!');
