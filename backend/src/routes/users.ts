import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import User from "../models/User";
import { Follow } from "../models/Follow";

const router = Router();

// GET /api/users - Fetch all users with their active Pub/Sub follows
router.get("/", async (req: Request, res: Response) => {
  try {
    const users = await User.find().lean();

    // Attach follows to each user for the storefront UI
    const usersWithFollows = await Promise.all(
      users.map(async (user: any) => {
        const userIdStr = user._id.toString();

        // Use 'as any' filter to prevent Mongoose ObjectId Uint8Array type conflict
        const follows = await Follow.find({
          userId: new Types.ObjectId(userIdStr) as any,
        }).lean();

        // Format follows back to a clean subscriptions mapping for the frontend UI
        const subscriptions = follows.map((f: any) => ({
          productId: f.topicId.toString(),
          inApp: Array.isArray(f.channels) && f.channels.includes("inApp"),
          email: Array.isArray(f.channels) && f.channels.includes("email"),
        }));

        return { ...user, subscriptions };
      }),
    );

    res.json(usersWithFollows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/users/:userId/watchlist - Toggle channel subscription via Follow model
router.patch("/:userId/watchlist", async (req: Request, res: Response) => {
  try {
    const rawUserId = Array.isArray(req.params.userId)
      ? req.params.userId[0]
      : req.params.userId;

    const { productId, channel } = req.body; // channel is "inApp" or "email"

    if (!productId || !channel) {
      return res
        .status(400)
        .json({ error: "productId and channel are required" });
    }

    const targetUserId = new Types.ObjectId(rawUserId);

    // Keep topicId as a standard string! Do not cast to ObjectId.
    const targetTopicId = String(productId);

    // 1. Find existing Follow record for this User + Topic
    let follow: any = await Follow.findOne({
      userId: targetUserId as any,
      topicId: targetTopicId as any,
    });

    if (!follow) {
      // If no follow exists, create one with the selected channel
      follow = new Follow({
        userId: targetUserId,
        topicId: targetTopicId,
        channels: [channel],
      });
      await follow.save();
    } else {
      // Toggle channel presence in the channels array
      const hasChannel = follow.channels.includes(channel);
      if (hasChannel) {
        follow.channels = follow.channels.filter((c: string) => c !== channel);
      } else {
        follow.channels.push(channel);
      }

      // If no channels remain, remove the Follow document entirely
      if (follow.channels.length === 0) {
        await Follow.deleteOne({ _id: follow._id });
      } else {
        await follow.save();
      }
    }

    // Return updated follows for this user
    const updatedFollows = await Follow.find({
      userId: targetUserId as any,
    }).lean();

    const formattedSubscriptions = updatedFollows.map((f: any) => ({
      productId: f.topicId.toString(),
      inApp: Array.isArray(f.channels) && f.channels.includes("inApp"),
      email: Array.isArray(f.channels) && f.channels.includes("email"),
    }));

    res.json({ success: true, subscriptions: formattedSubscriptions });
  } catch (error: any) {
    console.error("Failed to update watchlist preference:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
