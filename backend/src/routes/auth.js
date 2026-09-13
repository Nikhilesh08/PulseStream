const { Router } = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../models/User");
const { Follow } = require("../models/Follow");
const {
  requireAuth,
  getJWTSecret,
  isAdminEmail,
} = require("../middleware/auth");
const { sendEmail } = require("../config/mail");

const router = Router();

// --------------------------------------------------
// Validation helpers
// --------------------------------------------------

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isValidEmail(email) {
  // Reasonable application-level email syntax validation.
  // It does not verify mailbox existence.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  const value = String(password || "");
  if (value.length < 8) return "Password must be at least 8 characters long";
  if (!/[A-Z]/.test(value))
    return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(value))
    return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(value)) return "Password must contain at least one number";
  return null;
}

// --------------------------------------------------
// Remove sensitive fields before returning users
// --------------------------------------------------

function stripPassword(user) {
  const obj = user.toObject ? user.toObject() : user;
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  return obj;
}

// --------------------------------------------------
// Attach notification subscriptions
// --------------------------------------------------

async function attachSubscriptions(userObj) {
  const follows = await Follow.find({ userId: userObj._id }).lean();

  userObj.subscriptions = follows.map((f) => ({
    productId: String(f.topicId),
    inApp: Array.isArray(f.channels) && f.channels.includes("inApp"),
    email: Array.isArray(f.channels) && f.channels.includes("email"),
  }));

  userObj.isAdmin = isAdminEmail(userObj.email);
  return userObj;
}

// ==================================================
// SIGNUP
// POST /api/auth/signup
// ==================================================

router.post("/signup", async (req, res) => {
  try {
    const nameValue = String(req.body.name || "").trim();
    const emailValue = normalizeEmail(req.body.email);
    const passwordValue = String(req.body.password || "");

    if (!nameValue || !emailValue || !passwordValue) {
      return res.status(400).json({
        success: false,
        error: "Name, email, and password are required",
      });
    }

    if (nameValue.length < 2) {
      return res.status(400).json({
        success: false,
        error: "Name must be at least 2 characters long",
      });
    }

    if (nameValue.length > 100) {
      return res.status(400).json({
        success: false,
        error: "Name must be 100 characters or fewer",
      });
    }

    if (!isValidEmail(emailValue)) {
      return res
        .status(400)
        .json({ success: false, error: "Please enter a valid email address" });
    }

    const passwordError = validatePassword(passwordValue);
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError });
    }

    const existingUser = await User.findOne({ email: emailValue });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(passwordValue, 10);

    const user = await User.create({
      name: nameValue,
      email: emailValue,
      password: hashedPassword,
      avatar: "👤",
    });

    const token = jwt.sign({ id: user._id }, getJWTSecret(), {
      expiresIn: "7d",
    });
    let safeUser = stripPassword(user);
    safeUser.subscriptions = [];
    safeUser.isAdmin = isAdminEmail(safeUser.email);

    res.status(201).json({ success: true, token, user: safeUser });
  } catch (err) {
    console.error("❌ Signup failed:", err);
    res.status(500).json({ success: false, error: "Unable to create account" });
  }
});

// ==================================================
// LOGIN
// POST /api/auth/login
// ==================================================

router.post("/login", async (req, res) => {
  try {
    const emailValue = normalizeEmail(req.body.email);
    const passwordValue = String(req.body.password || "");

    if (!emailValue || !passwordValue) {
      return res
        .status(400)
        .json({ success: false, error: "Email and password are required" });
    }

    if (!isValidEmail(emailValue)) {
      return res
        .status(400)
        .json({ success: false, error: "Please enter a valid email address" });
    }

    const user = await User.findOne({ email: emailValue }).select("+password");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(passwordValue, user.password || "");
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user._id }, getJWTSecret(), {
      expiresIn: "7d",
    });
    const safeUser = await attachSubscriptions(stripPassword(user));

    res.status(200).json({ success: true, token, user: safeUser });
  } catch (err) {
    console.error("❌ Login failed:", err);
    res.status(500).json({ success: false, error: "Unable to complete login" });
  }
});

// ==================================================
// CURRENT USER
// GET /api/auth/me
// ==================================================

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const safeUser = await attachSubscriptions(stripPassword(user));
    res.status(200).json({ success: true, user: safeUser });
  } catch (err) {
    console.error("❌ Failed to fetch current user:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================================================
// FORGOT PASSWORD
// POST /api/auth/forgot-password
// ==================================================

router.post("/forgot-password", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!isValidEmail(email)) {
      return res
        .status(400)
        .json({ success: false, error: "Please enter a valid email address" });
    }

    const user = await User.findOne({ email });

    // Prevent email enumeration.
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If an account exists, a reset token was sent.",
      });
    }

    // Generate secure reset token.
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Store only hash in MongoDB.
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await User.findByIdAndUpdate(user._id, {
      resetPasswordToken: hashedToken,
      resetPasswordExpire: Date.now() + 15 * 60 * 1000,
    });

    const html = `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your PulseStream account.</p>
      <p>Your secure reset code is: <strong>${resetToken}</strong></p>
      <p>Enter this code in the application to choose a new password. This code expires in 15 minutes.</p>
    `;

    // Development mode check
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("SMTP is not configured");
      }
      console.warn(
        `⚠️ SMTP is not configured. Development reset code for ${user.email}: ${resetToken}`,
      );
      return res.status(200).json({
        success: true,
        message: "SMTP is not configured; use the development reset code.",
        devResetToken: resetToken,
      });
    }

    await sendEmail(user.email, "PulseStream: Password Reset", html);
    res
      .status(200)
      .json({ success: true, message: "Reset code sent to email" });
  } catch (err) {
    console.error("❌ Forgot password failed:", err);
    res.status(500).json({ success: false, error: "Email could not be sent" });
  }
});

// ==================================================
// RESET PASSWORD
// POST /api/auth/reset-password
// ==================================================

router.post("/reset-password", async (req, res) => {
  try {
    const token = String(req.body.token || "").trim();
    const newPassword = String(req.body.newPassword || "");

    if (!token) {
      return res
        .status(400)
        .json({ success: false, error: "A reset token is required" });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid or expired reset token" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      $unset: { resetPasswordToken: 1, resetPasswordExpire: 1 },
    });

    res.status(200).json({
      success: true,
      message: "Password updated successfully! You may now log in.",
    });
  } catch (err) {
    console.error("❌ Password reset failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
