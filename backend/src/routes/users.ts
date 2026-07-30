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
    const targetTopicId = String(productId);

    // 1. Find existing Follow record for this User + Topic
    let follow: any = await Follow.findOne({
      userId: targetUserId,
      topicId: targetTopicId,
    });

    if (!follow) {
      // If no follow exists, create one with the selected channel
      follow = new Follow({
        userId: targetUserId,
        topicId: targetTopicId,
        channels: [channel],
      });
    } else {
      // Toggle channel presence in the channels array
      const hasChannel = follow.channels.includes(channel);
      if (hasChannel) {
        follow.channels = follow.channels.filter((c: string) => c !== channel);
      } else {
        follow.channels.push(channel);
      }
    }

    // If no channels remain, remove the Follow document entirely
    if (follow.channels && follow.channels.length === 0) {
      if (follow._id) await Follow.deleteOne({ _id: follow._id });
    } else {
      await follow.save();
    }

    // 2. Fetch the base user document to return to the React frontend
    const user = await User.findById(targetUserId).lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 3. Get the freshly updated follows
    const updatedFollows = await Follow.find({
      userId: targetUserId,
    }).lean();

    const formattedSubscriptions = updatedFollows.map((f: any) => ({
      productId: f.topicId.toString(),
      inApp: Array.isArray(f.channels) && f.channels.includes("inApp"),
      email: Array.isArray(f.channels) && f.channels.includes("email"),
    }));

    const updatedUser = { ...user, subscriptions: formattedSubscriptions };

    res.json({ success: true, data: updatedUser });
  } catch (error: any) {
    // 🚨 If Mongoose crashes during the save, it will print in bright red here!
    console.error("🚨 [BACKEND] Watchlist DB Update Failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users/:userId/arm-all - GOD MODE: Auto-subscribe to all topics
router.post("/:userId/arm-all", async (req: Request, res: Response) => {
  try {
    const rawUserId = Array.isArray(req.params.userId)
      ? req.params.userId[0]
      : req.params.userId;
    const targetUserId = new Types.ObjectId(rawUserId);
    const { productIds } = req.body; // Expects an array of strings ["prod_1", "prod_2", ...]

    if (!Array.isArray(productIds)) {
      return res.status(400).json({ error: "productIds array is required" });
    }

    // 1. Wipe any existing partial subscriptions for this user to start completely fresh
    await Follow.deleteMany({ userId: targetUserId });

    // 2. Generate a payload to bulk-insert BOTH channels for every product
    const followsToInsert = productIds.map((id: string) => ({
      userId: targetUserId,
      topicId: id,
      channels: ["inApp", "email"],
    }));

    // 3. Perform a high-speed MongoDB Bulk Insert
    await Follow.insertMany(followsToInsert);

    // 4. Fetch the User and format the response perfectly for the React frontend
    const user = await User.findById(targetUserId).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const formattedSubscriptions = followsToInsert.map((f: any) => ({
      productId: f.topicId,
      inApp: true,
      email: true,
    }));

    res.json({
      success: true,
      data: { ...user, subscriptions: formattedSubscriptions },
    });
  } catch (error: any) {
    console.error("🚨 [BACKEND] God Mode Arming Failed:", error);
    res.status(500).json({ error: error.message });
  }
});
export default router;
