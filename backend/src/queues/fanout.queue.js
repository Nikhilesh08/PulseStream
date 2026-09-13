const { Queue } = require("bullmq");
const { getRedisConnectionOptions } = require("../config/redis");

const fanoutQueue = new Queue("fanout-queue", {
  connection: getRedisConnectionOptions("fanout-producer"),
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

console.log('📦 BullMQ "fanout-queue" producer is ready.');

module.exports = { fanoutQueue };
