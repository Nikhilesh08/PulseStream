const { Worker } = require("bullmq");
const { getRedisConnectionOptions } = require("../config/redis");
const { Notification } = require("../models/Notification");
const { Delivery } = require("../models/Delivery");
const { getIO, emitMetricsUpdate } = require("../config/socket");
const User = require("../models/User");

const inAppWorker = new Worker(
  "inapp-queue",
  async (job) => {
    const { eventId, userId, type, payload } = job.data;
    console.log(
      `🔔 In-App Worker: Processing event ${eventId} for user ${userId}`,
    );

    const user = await User.findById(userId);

    // Deleted/orphaned user
    if (!user) {
      if (eventId) {
        await Delivery.findOneAndUpdate(
          { eventId, userId, channel: "inApp" },
          {
            status: "failed",
            attempts: job.attemptsMade + 1,
            errorMessage: "User account was deleted from database.",
            faultType: "ORPHANED_USER",
          },
        );
        emitMetricsUpdate();
      }
      return;
    }

    try {
      const productName = payload?.productName || "An item on your watchlist";
      const newPrice = payload?.newPrice ?? "a new low price";
      const message = `Price Drop Alert: ${productName} is now $${newPrice}!`;

      // Persist notification first.
      // This makes the notification available even when the user is currently offline.
      const notification = await Notification.findOneAndUpdate(
        { userId, eventId },
        {
          $setOnInsert: { userId, eventId, message, read: false },
        },
        { upsert: true, returnDocument: true, setDefaultsOnInsert: true },
      );

      try {
        getIO()
          .to(String(userId))
          .emit("notification", { message, type, payload, notification });
        console.log(
          `⚡ Socket.io: Emitted notification to user room ${userId}`,
        );
      } catch (socketErr) {
        console.warn("⚠️ Socket emission skipped:", socketErr.message);
      }

      if (eventId) {
        await Delivery.findOneAndUpdate(
          { eventId, userId, channel: "inApp" },
          {
            status: "success",
            attempts: job.attemptsMade + 1,
            sentAt: new Date(),
            errorMessage: undefined,
            faultType: undefined,
          },
        );
        emitMetricsUpdate();
      }

      console.log(`✅ In-App Worker: Delivered to user ${userId}`);
    } catch (error) {
      if (eventId) {
        await Delivery.findOneAndUpdate(
          { eventId, userId, channel: "inApp" },
          {
            status: "failed",
            attempts: job.attemptsMade + 1,
            errorMessage: error.message,
            faultType: "INAPP_SAVE_ERROR",
          },
        );
        emitMetricsUpdate();
      }
      console.error(`❌ In-App Worker failed for ${userId}:`, error.message);
      throw error;
    }
  },
  {
    connection: getRedisConnectionOptions("inapp-worker", { worker: true }),
    concurrency: 5,
  },
);

inAppWorker.on("failed", (job, err) => {
  console.error(`❌ [In-App Worker] Job ${job?.id} failed:`, err.message);
});

inAppWorker.on("error", (err) => {
  console.error("❌ [In-App Worker] Worker error:", err.message);
});

module.exports = { inAppWorker };
