import { Queue } from "bullmq";
import { redisConnection } from "./redis";

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: false, // keep failed jobs so your DLQ/analytics view can inspect them
};

export const emailQueue = new Queue("email-queue", {
  connection: redisConnection,
  defaultJobOptions,
});

export const inAppQueue = new Queue("inapp-queue", {
  connection: redisConnection,
  defaultJobOptions,
});

export const fanoutQueue = new Queue("fanout-queue", {
  connection: redisConnection,
  defaultJobOptions,
});
