const jwt = require("jsonwebtoken");
const User = require("../models/User");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET must be set in .env — refusing to sign/verify tokens without it.",
    );
  }
  return secret;
}

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "No token provided" });
  }

  try {
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      return res
        .status(401)
        .json({ success: false, error: "No token provided" });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    req.userId = String(decoded.id);
    next();
  } catch {
    return res
      .status(401)
      .json({ success: false, error: "Invalid or expired token" });
  }
};

// Keep admin emails configurable so the demo account is not hard-wired into
// the authorization logic. Multiple addresses can be comma-separated.

function getAdminEmails() {
  const configured = [
    ...(process.env.ADMIN_EMAILS?.split(",") || []),
    process.env.ADMIN_EMAIL || "",
  ]
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(configured)];
}

const isAdminEmail = (email) =>
  getAdminEmails().includes(
    String(email || "")
      .trim()
      .toLowerCase(),
  );

const requireAdmin = async (req, res, next) => {
  try {
    const caller = await User.findById(req.userId).select("email");
    if (!caller || !isAdminEmail(caller.email)) {
      return res
        .status(403)
        .json({ success: false, error: "Admin access only" });
    }
    next();
  } catch (error) {
    next(error);
  }
};

const requireSelfOrAdmin =
  (paramName = "id") =>
  async (req, res, next) => {
    try {
      if (String(req.params[paramName]) === String(req.userId)) return next();

      const caller = await User.findById(req.userId).select("email");
      if (!caller || !isAdminEmail(caller.email)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      next();
    } catch (error) {
      next(error);
    }
  };

module.exports = {
  requireAuth,
  requireAdmin,
  requireSelfOrAdmin,
  getJwtSecret,
  getJWTSecret: getJwtSecret,
  isAdminEmail,
  getAdminEmails,
};
