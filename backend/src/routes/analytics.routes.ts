import { Router } from "express";
import {
  getSystemMetrics,
  getFailedDeliveries,
  retryFailedDelivery,
} from "../controllers/analytics.controller";

const router = Router();

// GET /api/analytics -> Fetch Flight Recorder health stats (Success Rate, Totals)
router.get("/", getSystemMetrics);

// GET /api/analytics/failures -> Fetch Dead Letter Queue with Smart Categorization
router.get("/failures", getFailedDeliveries);

// POST /api/analytics/retry/:id -> One-Click Resurrection Engine
router.post("/retry/:id", retryFailedDelivery);

export default router;
