const { Worker } = require("bullmq");
const { getRedisConnectionOptions } = require("../config/redis");
const { Follow } = require("../models/Follow");
const { Delivery } = require("../models/Delivery");
const User = require("../models/User");
const { emailQueue } = require("../queues/email.queue");
const { inAppQueue } = require("../queues/inapp.queue");
const { emitMetricsUpdate } = require("../config/socket");

const fanoutWorker = new Worker(
  "fanout-queue",
  async (job) => {
    const { eventId, topicId, type, payload } = job.data;

    if (!eventId || !topicId) {
      throw new Error("Fanout job is missing eventId or topicId");
    }

    console.log(
      `📣 [Fanout Worker] Processing event ${eventId} for topic ${topicId}`,
    );

    const followers = await Follow.find({
      topicId: String(topicId),
      channels: { $in: ["email", "inApp"] },
    }).lean();

    console.log(`[Fanout Worker] Found ${followers.length} active followers.`);

    if (followers.length === 0) {
      console.warn(
        `⚠️ [Fanout Worker] No subscribers for topicId "${topicId}". Event ${eventId} was recorded but has no deliveries.`,
      );
      return;
    }

    for (const follower of followers) {
      const userExists = await User.exists({ _id: follower.userId });

      if (!userExists) {
        console.warn(
          `🧹 [Fanout Worker] Removing orphaned follow for deleted user ${follower.userId}.`,
        );
        await Follow.deleteMany({ userId: follower.userId });
        continue;
      }

      // Email delivery
      if (follower.channels.includes("email")) {
        await Delivery.findOneAndUpdate(
          { eventId, userId: follower.userId, channel: "email" },
          {
            $set: {
              status: "pending",
              sentAt: null,
              errorMessage: undefined,
              faultType: undefined,
            },
            $setOnInsert: { attempts: 0 },
          },
          { upsert: true, returnDocument: true, setDefaultsOnInsert: true },
        );

        const emailJobId = `delivery-${eventId}-${follower.userId}-email`;
        await emailQueue.add(
          "send-email",
          { eventId, userId: follower.userId, type, payload },
          { jobId: emailJobId },
        );
      }

      // In-App delivery
      if (follower.channels.includes("inApp")) {
        await Delivery.findOneAndUpdate(
          { eventId, userId: follower.userId, channel: "inApp" },
          {
            $set: {
              status: "pending",
              sentAt: null,
              errorMessage: undefined,
              faultType: undefined,
            },
            $setOnInsert: { attempts: 0 },
          },
          { upsert: true, returnDocument: true, setDefaultsOnInsert: true },
        );

        const inAppJobId = `delivery-${eventId}-${follower.userId}-inapp`;
        await inAppQueue.add(
          "send-inapp",
          { eventId, userId: follower.userId, type, payload },
          { jobId: inAppJobId },
        );
      }
    }

    // Tell connected admin dashboards that the Delivery collection has changed.
    emitMetricsUpdate();
    console.log(`✅ [Fanout Worker] Fan-out completed for event ${eventId}.`);
  },
  {
    connection: getRedisConnectionOptions("fanout-worker", { worker: true }),
  },
);

fanoutWorker.on("failed", (job, err) => {
  console.error(`❌ [Fanout Worker] Job ${job?.id} failed:`, err.message);
});

fanoutWorker.on("error", (err) => {
  console.error("❌ [Fanout Worker] Worker error:", err.message);
});

module.exports = { fanoutWorker };
