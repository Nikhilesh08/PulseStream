import { Request, Response } from "express";
import { Event } from "../models/Event";
import { Follow } from "../models/Follow";
import { Notification } from "../models/Notification";
import { Topic } from "../models/Topic";
import { fanoutQueue } from "../workers/fanout.worker";

// 1. TRIGGER EVENT (The missing link for the Dashboard Analytics!)
export const triggerEvent = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { topicId, type, payload } = req.body;

    if (!topicId || !type || !payload) {
      res
        .status(400)
        .json({ error: "topicId, type, and payload are required" });
      return;
    }

    const safeTopicId = String(topicId);

    const newEvent = await Event.create({
      topicId: safeTopicId,
      type,
      payload,
    });

    console.log(`✅ Official Event Created in DB with ID: ${newEvent._id}`);

    // Without this, the workers have no idea what to attach their success/fail logs to.
    await fanoutQueue.add("process-event", {
      eventId: newEvent._id, // <--- THIS IS THE MAGIC KEY FOR THE DASHBOARD
      topicId: safeTopicId,
      type: newEvent.type,
      payload: newEvent.payload,
    });

    console.log(
      `📦 [BullMQ]: Job pushed to 'fanout-queue' for Event ID ${newEvent._id}`,
    );

    res.status(201).json({
      success: true,
      message: "Event accepted and queued for background processing!",
      event: newEvent,
    });
  } catch (error: any) {
    console.error("🚨 Failed to trigger event:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 2. GET USER NOTIFICATIONS (For the in-app bell icon)
export const getNotifications = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = req.params;
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50); // Keep it fast, only fetch recent 50

    res.status(200).json({ success: true, data: notifications });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 3. FOLLOW A TOPIC (Opt-in to notifications)
export const followTopic = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId, topicId, channels } = req.body;

    if (!userId || !topicId || !channels || !Array.isArray(channels)) {
      res.status(400).json({
        error: "userId, topicId, and an array of channels are required",
      });
      return;
    }

    const follow = await Follow.findOneAndUpdate(
      { userId, topicId: String(topicId) },
      { channels },
      { upsert: true, new: true },
    );

    res.status(200).json({ success: true, data: follow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 4. UNFOLLOW A TOPIC (Opt-out)
export const unfollowTopic = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const deletedFollow = await Follow.findByIdAndDelete(id);

    if (!deletedFollow) {
      res.status(404).json({ error: "Follow subscription not found" });
      return;
    }

    res.status(200).json({ success: true, message: "Unfollowed successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 5. CREATE A TOPIC (Optional/Admin)
export const createTopic = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: "Topic name is required" });
      return;
    }

    const topic = new Topic({ name });
    await topic.save();

    res.status(201).json({ message: "Topic created successfully", topic });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: "A topic with this name already exists" });
      return;
    }
    res.status(500).json({ error: error.message });
  }
};
