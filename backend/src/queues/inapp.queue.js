const { Queue } = require("bullmq");
const { getRedisConnectionOptions } = require("../config/redis");

const inAppQueue = new Queue("inapp-queue", {
  connection: getRedisConnectionOptions("inapp-producer"),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: false,
  },
});

console.log('📦 BullMQ "inapp-queue" producer is ready.');

module.exports = { inAppQueue };
