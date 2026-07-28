import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { requireAuth, AuthRequest, getJWTSecret } from "../middleware/auth";

const router = Router();
const MASTER_EMAIL = "test@pulsestream.io";
const MASTER_PASSWORD = "test1234";

function stripPassword(user: any) {
  const obj = user.toObject ? user.toObject() : user;
  delete obj.password;
  return obj;
}

// POST /api/auth/signup
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "name, email, and password are required",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      avatar: "👤",
      subscriptions: [],
    });

    const token = jwt.sign({ id: user._id }, getJWTSecret(), {
      expiresIn: "7d",
    });
    res.status(201).json({ success: true, token, user: stripPassword(user) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, error: "email and password are required" });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Master bypass is scoped ONLY to the exact seeded master email — never global.
    const isMasterBypass =
      email === MASTER_EMAIL && password === MASTER_PASSWORD;
    const isMatch =
      isMasterBypass || (await bcrypt.compare(password, user.password || ""));

    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid password" });
    }

    const token = jwt.sign({ id: user._id }, getJWTSecret(), {
      expiresIn: "7d",
    });
    res.status(200).json({ success: true, token, user: stripPassword(user) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/me — restores session on page refresh
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });
    res.status(200).json({ success: true, user: stripPassword(user) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
