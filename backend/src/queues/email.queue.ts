import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

// Dedicated queue for emails with exponential backoff for SMTP retries
export const emailQueue = new Queue("email-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000, // Wait 2s, then 4s, then 8s if the email server glitches
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

console.log(
  '📦 BullMQ "email-queue" is ready for rate-limited email delivery!',
);
