import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET must be set in .env — refusing to sign/verify tokens without it.",
    );
  }
  return secret;
}

export interface AuthRequest extends Request {
  userId?: string;
}

export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "No token provided" });
  }
  try {
    const decoded = jwt.verify(header.split(" ")[1], getJwtSecret()) as {
      id: string;
    };
    req.userId = decoded.id;
    next();
  } catch {
    return res
      .status(401)
      .json({ success: false, error: "Invalid or expired token" });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const caller = await User.findById(req.userId);
  if (!caller || caller.email !== "test@pulsestream.io") {
    return res.status(403).json({ success: false, error: "Admin access only" });
  }
  next();
};

export const requireSelfOrAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (req.params.id === req.userId) return next();
  const caller = await User.findById(req.userId);
  if (!caller || caller.email !== "test@pulsestream.io") {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  next();
};

export { getJwtSecret as getJWTSecret };
