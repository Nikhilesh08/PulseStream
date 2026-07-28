import { Request, Response } from "express";
import { fanoutQueue } from "../queues/fanout.queue";
import { Topic } from "../models/Topic";
import { Follow } from "../models/Follow";
import { Event } from "../models/Event";
import { Notification } from "../models/Notification";

// 1. Create a new topic (e.g., "iPhone 16 Price Drop")
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

// 2. Follow a topic with specific notification channels
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

    const follow = new Follow({ userId, topicId: String(topicId), channels });
    await follow.save();

    res.status(201).json({ message: "Topic followed successfully", follow });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: "User is already following this topic" });
      return;
    }
    res.status(500).json({ error: error.message });
  }
};

// 3. Unfollow a topic
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

    res.status(200).json({ message: "Unfollowed successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Trigger an event (Phase 2: Asynchronous push to BullMQ)
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

    // Safely enforce topicId as a String
    const safeTopicId = String(topicId);

    // Save the event to the database
    const event = new Event({ topicId: safeTopicId, type, payload });
    await event.save();

    // 🔥 PHASE 2 UPGRADE: Push job onto BullMQ conveyor belt!
    await fanoutQueue.add("process-fanout", {
      eventId: event._id,
      topicId: safeTopicId,
      type: event.type,
      payload: event.payload,
    });

    console.log(
      `📦 [BullMQ]: Job pushed to 'fanout-queue' for Event ID ${event._id}`,
    );

    res.status(201).json({
      message: "Event accepted and queued for background processing!",
      event,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Fetch a user's in-app notification inbox
export const getNotifications = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = req.params;

    const notifications = await Notification.find({
      userId: userId as any,
    }).sort({
      createdAt: -1,
    });

    res.status(200).json(notifications);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
