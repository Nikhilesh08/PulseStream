const { Router } = require("express");

const { Delivery } = require("../models/Delivery");
const { Event } = require("../models/Event");
const { Notification } = require("../models/Notification");

const { emailQueue } = require("../queues/email.queue");
const { inAppQueue } = require("../queues/inapp.queue");
const { fanoutQueue } = require("../queues/fanout.queue");

const { requireAuth, requireAdmin } = require("../middleware/auth");

const { emitMetricsUpdate } = require("../config/socket");

const router = Router();
async function waitForNoActiveJobs(queues, timeoutMs = 15000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const activeCounts = await Promise.all(
      queues.map((queue) => queue.getActiveCount()),
    );

    const hasActiveJobs = activeCounts.some((count) => count > 0);

    if (!hasActiveJobs) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Timed out waiting for active BullMQ jobs to finish.");
}

function categorizeFailure(errorMessage = "Unknown delivery error") {
  const message = String(errorMessage);

  if (
    message.includes("552") ||
    message.includes("Mailbox is full") ||
    message.includes("Quota exceeded")
  ) {
    return { faultType: "USER_QUOTA_EXCEEDED", actionable: false };
  }

  if (
    message.includes("550") ||
    message.includes("User unknown") ||
    message.includes("Invalid domain")
  ) {
    return { faultType: "INVALID_EMAIL_ADDRESS", actionable: false };
  }

  return { faultType: "SYSTEM_INFRASTRUCTURE_ERROR", actionable: true };
}

// GET /api/analytics -> Real-time delivery metrics using MongoDB aggregation.
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const stats = await Delivery.aggregate([
      {
        $group: {
          _id: null,
          totalProcessed: { $sum: 1 },
          successful: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalProcessed: 1,
          successful: 1,
          failed: 1,
          pending: 1,
          successRate: {
            $cond: [
              { $eq: ["$totalProcessed", 0] },
              100,
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ["$successful", "$totalProcessed"] },
                      100,
                    ],
                  },
                  1,
                ],
              },
            ],
          },
        },
      },
    ]);

    res.json(
      stats[0] || {
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        pending: 0,
        successRate: 100,
      },
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/failures -> Failed deliveries with fault classification.
router.get("/failures", requireAuth, requireAdmin, async (req, res) => {
  try {
    const failures = await Delivery.find({ status: "failed" })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("userId", "name email")
      .populate("eventId", "type payload")
      .lean();

    res.json(
      failures.map((delivery) => {
        const { faultType, actionable } = categorizeFailure(
          delivery.errorMessage,
        );
        return {
          ...delivery,
          faultType: delivery.faultType || faultType,
          actionable,
        };
      }),
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/analytics/retry/:id -> Re-inject a failed delivery into BullMQ.
router.post("/retry/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id).populate("eventId");
    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }
    if (delivery.status !== "failed") {
      return res
        .status(400)
        .json({ error: "Only failed deliveries can be retried" });
    }

    const event = delivery.eventId;
    if (!event) {
      return res
        .status(404)
        .json({ error: "Original event payload no longer exists" });
    }

    delivery.status = "pending";
    delivery.errorMessage = undefined;
    delivery.faultType = undefined;
    delivery.sentAt = null;
    delivery.attempts = 0;
    await delivery.save();

    const jobId = `retry-${delivery._id}-${Date.now()}`;
    if (delivery.channel === "email") {
      await emailQueue.add(
        "send-email",
        {
          eventId: event._id,
          userId: delivery.userId,
          type: event.type,
          subject: `[Retry] Alert: ${String(event.type).replaceAll("_", " ").toUpperCase()}`,
          payload: event.payload,
        },
        { jobId },
      );
    } else if (delivery.channel === "inApp") {
      await inAppQueue.add(
        "send-inapp",
        {
          eventId: event._id,
          userId: delivery.userId,
          type: event.type,
          payload: event.payload,
        },
        { jobId },
      );
    } else {
      return res
        .status(400)
        .json({ error: `Unsupported delivery channel: ${delivery.channel}` });
    }

    res.json({ success: true, message: "Delivery re-queued successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/analytics/reset -> Reset analytics data and pending notification jobs. Admin-only.
router.post("/reset", requireAuth, requireAdmin, async (req, res) => {
  const queues = [fanoutQueue, inAppQueue, emailQueue];

  let queuesPaused = false;

  try {
    console.log("🧹 [Reset Metrics] Starting reset...");

    // Stop new jobs from being picked up.
    await Promise.all(queues.map((queue) => queue.pause()));

    queuesPaused = true;

    console.log("⏸️ [Reset Metrics] BullMQ queues paused.");

    // Let jobs that are already running finish.
    await waitForNoActiveJobs(queues);

    console.log("✅ [Reset Metrics] No active BullMQ jobs remain.");

    // Remove waiting, delayed, completed and failed jobs.
    await Promise.all(
      queues.map((queue) =>
        queue.obliterate({
          force: true,
        }),
      ),
    );

    console.log("🗑️ [Reset Metrics] BullMQ queues cleared.");

    // Delete only analytics/runtime data.
    const [events, deliveries, notifications] = await Promise.all([
      Event.deleteMany({}),
      Delivery.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    console.log("🗑️ [Reset Metrics] MongoDB analytics data cleared.");

    // Tell every connected admin dashboard to refresh.
    emitMetricsUpdate();

    console.log("📊 [Reset Metrics] Metrics update emitted.");

    res.json({
      success: true,
      message: "Metrics and pending notification jobs have been reset.",

      deleted: {
        events: events.deletedCount || 0,

        deliveries: deliveries.deletedCount || 0,

        notifications: notifications.deletedCount || 0,
      },

      preserved: ["users", "follows", "topics"],
    });
  } catch (err) {
    console.error("❌ [Reset Metrics] Failed:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  } finally {
    if (queuesPaused) {
      await Promise.all(
        queues.map((queue) =>
          queue.resume().catch((resumeError) => {
            console.error(
              `❌ Failed to resume ${queue.name}:`,
              resumeError.message,
            );
          }),
        ),
      );

      console.log("▶️ [Reset Metrics] BullMQ queues resumed.");
    }
  }
});

module.exports = router;
