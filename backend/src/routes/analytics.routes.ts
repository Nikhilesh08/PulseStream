import { Router, Request, Response } from "express";
import { Delivery } from "../models/Delivery";
import { Event } from "../models/Event";

const router = Router();

// GET /api/analytics -> Fetch Flight Recorder health stats
router.get("/", async (req: Request, res: Response) => {
  try {
    const totalProcessed = await Delivery.countDocuments();
    const successful = await Delivery.countDocuments({ status: "success" });
    const failed = await Delivery.countDocuments({ status: "failed" });

    let successRate = 100;
    if (totalProcessed > 0) {
      successRate = Number(((successful / totalProcessed) * 100).toFixed(1));
    }

    res.json({ totalProcessed, successful, failed, successRate });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/failures -> Fetch Dead Letter Queue
router.get("/failures", async (req: Request, res: Response) => {
  try {
    const failures = await Delivery.find({ status: "failed" })
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(failures);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/analytics/retry/:id -> One-Click Resurrection
router.post("/retry/:id", async (req: Request, res: Response) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });

    delivery.status = "pending";
    await delivery.save();
    res.json({ success: true, message: "Job successfully re-queued" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 💣 GET /api/analytics/nuke -> Changed to GET so it works in your browser!
router.get("/nuke", async (req: Request, res: Response) => {
  try {
    await Delivery.deleteMany({});
    await Event.deleteMany({});
    res.json({
      success: true,
      message: "Zombies eradicated. Database wiped clean.",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
