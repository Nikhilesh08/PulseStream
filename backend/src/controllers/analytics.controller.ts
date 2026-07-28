import { Request, Response } from "express";
import { Delivery } from "../models/Delivery";
import { emailQueue } from "../queues/email.queue";
import { inAppQueue } from "../queues/inapp.queue";

// 1. THE FLIGHT RECORDER: Real-time system health metrics using MongoDB Aggregation
export const getSystemMetrics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const stats = await Delivery.aggregate([
      {
        $group: {
          _id: null,
          totalProcessed: { $sum: 1 },
          successful: {
            $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] },
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
          // Calculate Success Rate Percentage dynamically!
          successRate: {
            $cond: [
              { $eq: ["$totalProcessed", 0] },
              100, // Default to 100% if no deliveries yet
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

    // If database is empty, return default clean numbers
    const result = stats[0] || {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      pending: 0,
      successRate: 100,
    };

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 2. THE DLQ INSPECTOR: Fetch failed jobs with Smart Fault Categorization
export const getFailedDeliveries = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const failures = await Delivery.find({ status: "failed" })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("userId", "name email") // Populate user details to see who didn't get their alert!
      .populate("eventId", "type payload");

    // Smart categorization: Separate "Our Fault" from "Their Fault"
    const categorizedFailures = failures.map((doc: any) => {
      const errorMsg = doc.errorMessage || "Unknown SMTP / Socket error";
      let faultType = "SYSTEM_INFRASTRUCTURE_ERROR"; // Default to our fault
      let actionable = true;

      if (
        errorMsg.includes("552") ||
        errorMsg.includes("Mailbox is full") ||
        errorMsg.includes("Quota exceeded")
      ) {
        faultType = "USER_QUOTA_EXCEEDED";
        actionable = false; // Don't bother retrying until user clears space
      } else if (
        errorMsg.includes("550") ||
        errorMsg.includes("User unknown") ||
        errorMsg.includes("Invalid domain")
      ) {
        faultType = "INVALID_EMAIL_ADDRESS";
        actionable = false;
      }

      return {
        _id: doc._id,
        channel: doc.channel,
        user: doc.userId,
        event: doc.eventId,
        errorMessage: errorMsg,
        faultType,
        actionable,
        failedAt: doc.updatedAt || doc.createdAt,
      };
    });

    res.status(200).json(categorizedFailures);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 3. THE RESURRECTION ENGINE: Re-inject a failed job back into BullMQ & Upstash Redis
export const retryFailedDelivery = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    // Find the dead delivery record and populate event data
    const delivery = await Delivery.findById(id).populate("eventId");
    if (!delivery) {
      res.status(404).json({ error: "Delivery record not found" });
      return;
    }

    if (delivery.status !== "failed") {
      res.status(400).json({ error: "Only failed deliveries can be retried" });
      return;
    }

    const event: any = delivery.eventId;
    if (!event) {
      res
        .status(404)
        .json({ error: "Original event payload no longer exists in database" });
      return;
    }

    // Mark status as pending while we re-queue
    delivery.status = "pending";
    await delivery.save();

    // Re-inject into the correct Upstash Redis conveyor belt!
    if (delivery.channel === "email") {
      await emailQueue.add(
        "send-email",
        {
          eventId: event._id,
          userId: delivery.userId,
          subject: `[Retry] Alert: ${event.type.replace("_", " ").toUpperCase()}`,
          message: `An update occurred on a topic you follow: ${event.type.replace("_", " ").toUpperCase()}`,
          payload: event.payload,
        },
        {
          jobId: `retry:${delivery._id}:${Date.now()}`, // Unique job ID for the retry attempt
        },
      );
      console.log(
        `♻️ [Resurrection Engine]: Re-queued email job for Delivery ID ${delivery._id}`,
      );
    } else if (delivery.channel === "inApp") {
      await inAppQueue.add(
        "send-inapp",
        {
          eventId: event._id,
          userId: delivery.userId,
          message: `[Retry] Alert: ${event.type.replace("_", " ").toUpperCase()}!`,
          payload: event.payload,
        },
        {
          jobId: `retry:${delivery._id}:${Date.now()}`,
        },
      );
      console.log(
        `♻️ [Resurrection Engine]: Re-queued inApp job for Delivery ID ${delivery._id}`,
      );
    }

    res
      .status(200)
      .json({ message: "Job successfully re-injected into BullMQ!", delivery });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
