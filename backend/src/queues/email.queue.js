const { Queue } = require("bullmq");
const { getRedisConnectionOptions } = require("../config/redis");

const emailQueue = new Queue("email-queue", {
  connection: getRedisConnectionOptions("email-producer"),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: false,
  },
});

console.log('📦 BullMQ "email-queue" producer is ready.');

module.exports = { emailQueue };
