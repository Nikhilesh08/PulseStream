const { Router } = require("express");
const { Types } = require("mongoose");
const User = require("../models/User");
const { Follow } = require("../models/Follow");
const {
  requireAuth,
  requireAdmin,
  requireSelfOrAdmin,
} = require("../middleware/auth");

const router = Router();

function formatSubscriptions(follows) {
  return follows.map((follow) => ({
    productId: String(follow.topicId),
    inApp: Array.isArray(follow.channels) && follow.channels.includes("inApp"),
    email: Array.isArray(follow.channels) && follow.channels.includes("email"),
  }));
}

// GET /api/users - Admin-only observability endpoint.
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().lean();
    const usersWithFollows = await Promise.all(
      users.map(async (user) => {
        const follows = await Follow.find({ userId: user._id }).lean();
        return { ...user, subscriptions: formatSubscriptions(follows) };
      }),
    );
    res.json(usersWithFollows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/users/:userId/watchlist - Toggle a user's notification channel.
router.patch(
  "/:userId/watchlist",
  requireAuth,
  requireSelfOrAdmin("userId"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { productId, channel } = req.body;

      if (!Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: "Invalid userId" });
      }
      if (!productId || !["inApp", "email"].includes(channel)) {
        return res.status(400).json({
          error:
            'productId and channel must be provided; channel must be "inApp" or "email"',
        });
      }

      const targetUserId = new Types.ObjectId(userId);
      const targetTopicId = String(productId).trim();
      let follow = await Follow.findOne({
        userId: targetUserId,
        topicId: targetTopicId,
      });

      if (!follow) {
        follow = new Follow({
          userId: targetUserId,
          topicId: targetTopicId,
          channels: [channel],
        });
      } else if (follow.channels.includes(channel)) {
        follow.channels = follow.channels.filter((item) => item !== channel);
      } else {
        follow.channels.push(channel);
      }

      if (follow.channels.length === 0) {
        await Follow.deleteOne({ _id: follow._id });
      } else {
        await follow.save();
      }

      const user = await User.findById(targetUserId).lean();
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const updatedFollows = await Follow.find({ userId: targetUserId }).lean();
      res.json({
        success: true,
        data: { ...user, subscriptions: formatSubscriptions(updatedFollows) },
      });
    } catch (error) {
      console.error("🚨 [BACKEND] Watchlist DB Update Failed:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// POST /api/users/:userId/arm-all - Admin-only demo helper.
// This is also used by the seeded demo admin when explicit test subscriptions are needed.
router.post("/:userId/arm-all", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { productIds } = req.body;

    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res
        .status(400)
        .json({ error: "productIds must be a non-empty array" });
    }

    const targetUserId = new Types.ObjectId(userId);
    const cleanProductIds = [
      ...new Set(productIds.map((id) => String(id).trim()).filter(Boolean)),
    ];

    await Follow.deleteMany({ userId: targetUserId });

    const followsToInsert = cleanProductIds.map((topicId) => ({
      userId: targetUserId,
      topicId,
      channels: ["inApp", "email"],
    }));

    await Follow.insertMany(followsToInsert);

    const user = await User.findById(targetUserId).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      success: true,
      data: {
        ...user,
        subscriptions: formatSubscriptions(followsToInsert),
      },
    });
  } catch (error) {
    console.error(
      "🚨 [BACKEND] Failed to enable all notification subscriptions:",
      error,
    );
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
