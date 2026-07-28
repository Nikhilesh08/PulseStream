import { Router } from "express";
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

// User notification inbox
router.get("/notifications/:userId", getNotifications);

export default router;
