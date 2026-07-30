import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User";
import { Follow } from "../models/Follow";
import { requireAuth, AuthRequest, getJWTSecret } from "../middleware/auth";
import { sendEmail } from "../config/mail"; // Assuming your mailer is here!

const router = Router();

function stripPassword(user: any) {
  const obj = user.toObject ? user.toObject() : user;
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  return obj;
}

async function attachSubscriptions(userObj: any) {
  const follows = await Follow.find({ userId: userObj._id }).lean();
  userObj.subscriptions = follows.map((f: any) => ({
    productId: f.topicId.toString(),
    inApp: Array.isArray(f.channels) && f.channels.includes("inApp"),
    email: Array.isArray(f.channels) && f.channels.includes("email"),
  }));
  return userObj;
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
    });

    const token = jwt.sign({ id: user._id }, getJWTSecret(), {
      expiresIn: "7d",
    });

    let safeUser = stripPassword(user);
    safeUser.subscriptions = [];

    res.status(201).json({ success: true, token, user: safeUser });
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

    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid password" });
    }

    const token = jwt.sign({ id: user._id }, getJWTSecret(), {
      expiresIn: "7d",
    });

    const safeUser = await attachSubscriptions(stripPassword(user));

    res.status(200).json({ success: true, token, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });

    const safeUser = await attachSubscriptions(stripPassword(user));
    res.status(200).json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // Return 200 even if user not found to prevent email enumeration attacks
      return res.status(200).json({
        success: true,
        message: "If an account exists, a reset token was sent.",
      });
    }

    // Generate secure 20-byte random hex token
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Hash token via SHA-256 for database storage
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await User.findByIdAndUpdate(user._id, {
      resetPasswordToken: hashedToken,
      resetPasswordExpire: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    // Send Email
    const html = `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your PulseStream account.</p>
      <p>Your secure reset code is: <strong>${resetToken}</strong></p>
      <p>Enter this code on the application to choose a new password. This code expires in 15 minutes.</p>
    `;

    await sendEmail(user.email, "PulseStream: Password Reset", html);

    res
      .status(200)
      .json({ success: true, message: "Reset code sent to email" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Email could not be sent" });
  }
});

//  POST /api/auth/reset-password
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    // Re-hash the incoming token to compare against the DB
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }, // Ensure it hasn't expired
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid or expired reset token" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear out the old tokens
    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      resetPasswordToken: undefined,
      resetPasswordExpire: undefined,
    });

    res.status(200).json({
      success: true,
      message: "Password updated successfully! You may now log in.",
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
