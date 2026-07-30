import { Router } from "express";

import { Notification } from "../models/Notification";
import {
  createTopic,
  followTopic,
  unfollowTopic,
  triggerEvent,
  getNotifications,
} from "../controllers/notification.controller";

const router = Router();

// Topic routes
router.post("/topics", createTopic);

// Follow/Subscription routes
router.post("/follows", followTopic);
router.delete("/follows/:id", unfollowTopic);

// Event triggering
router.post("/events", triggerEvent);

// Clear Inbox Route
router.delete("/notifications/clear/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    await Notification.deleteMany({ userId: userId });
    res.status(200).json({ message: "Inbox cleared successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear inbox" });
  }
});

// User notification inbox
router.get("/notifications/:userId", getNotifications);

export default router;
