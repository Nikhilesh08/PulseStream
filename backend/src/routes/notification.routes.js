const { Router } = require("express");
const { Notification } = require("../models/Notification");
const {
  createTopic,
  followTopic,
  unfollowTopic,
  triggerEvent,
  getNotifications,
} = require("../controllers/notification.controller");
const {
  requireAuth,
  requireAdmin,
  requireSelfOrAdmin,
} = require("../middleware/auth");

const router = Router();

router.post("/topics", requireAuth, requireAdmin, createTopic);
router.post("/follows", requireAuth, followTopic);
router.delete("/follows/:id", requireAuth, unfollowTopic);
router.post("/events", requireAuth, requireAdmin, triggerEvent);

router.delete(
  "/notifications/clear/:userId",
  requireAuth,
  requireSelfOrAdmin("userId"),
  async (req, res) => {
    try {
      await Notification.deleteMany({ userId: req.params.userId });
      res.status(200).json({ success: true, message: "Inbox cleared successfully!" });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to clear inbox" });
    }
  },
);

router.get(
  "/notifications/:userId",
  requireAuth,
  requireSelfOrAdmin("userId"),
  getNotifications,
);

module.exports = router;
