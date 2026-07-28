import dotenv from "dotenv";
import path from "path";
// 🔒 SECURITY FIX: Load environment variables BEFORE importing ANY custom routes or files!
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import express, { Application, Request, Response } from "express";
import http from "http";
import cors from "cors";
import bcrypt from "bcryptjs";
import { connectDB } from "./config/db";
import "./config/redis";
import "./workers/fanout.worker";
import "./workers/inapp.worker";
import "./workers/email.worker";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import User from "./models/User";
import analyticsRoutes from "./routes/analytics.routes";
import notificationRoutes from "./routes/notification.routes";
import { initializeSocket } from "./config/socket";

const app: Application = express();
const PORT = process.env.PORT || 5000;

// 3. Create HTTP server wrapping Express
const httpServer = http.createServer(app);

// 4. Initialize Socket.io on the HTTP server
initializeSocket(httpServer);

// Middleware
app.use(cors());
app.use(express.json());

// Health-check route
app.get("/health", (req: Request, res: Response) => {
  res
    .status(200)
    .json({ status: "OK", message: "PulseStream Server is running!" });
});

// Mount API routes
app.use("/api/auth", authRoutes); // <-- NEW: Mounted real authentication!
app.use("/api/users", userRoutes); // Mounted Dynamic User Watchlist API!
app.use("/api", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);

// Start server and connect to database
const startServer = async () => {
  try {
    await connectDB();

    // <-- NEW: Auto-seed the Master Test User with ALL products subscribed!
    // We check by email so it generates even if other users already exist in your DB.
    const testEmail = "test@pulsestream.io";
    const existingMaster = await User.findOne({ email: testEmail });

    if (!existingMaster) {
      const hashedPassword = await bcrypt.hash("test1234", 10);
      await User.create({
        name: "Master Test User",
        email: testEmail,
        password: hashedPassword,
        avatar: "🔥",
        subscriptions: [
          { productId: "prod_1", inApp: true, email: true },
          { productId: "prod_2", inApp: true, email: true },
          { productId: "prod_3", inApp: true, email: true },
          { productId: "prod_4", inApp: true, email: true },
          { productId: "prod_5", inApp: true, email: true },
        ],
      });
      console.log(
        "🔥 Seeded Master Test User (test@pulsestream.io / pass: test1234) with ALL products subscribed!",
      );
    }

    // 5. IMPORTANT: Listen using httpServer instead of app.listen!
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server & WebSockets running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
