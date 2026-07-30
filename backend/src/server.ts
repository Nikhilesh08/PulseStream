import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import express, { Application, Request, Response } from "express";
import http from "http";
import cors from "cors";
import bcrypt from "bcryptjs";
import { connectDB } from "./config/db";
import "./config/redis";

import { fanoutWorker } from "./workers/fanout.worker";
import { inAppWorker } from "./workers/inapp.worker";
import { emailWorker } from "./workers/email.worker";

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
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);

// Start server and connect to database
const startServer = async () => {
  try {
    await connectDB();

    const masterEmail = "nikhileshkumar317@gmail.com";
    const existingMaster = await User.findOne({ email: masterEmail });

    if (!existingMaster) {
      const hashedPassword = await bcrypt.hash("test1234", 10);
      await User.create({
        name: "Nikhilesh Kumar Gubba", // Updated to official profile format
        email: masterEmail,
        password: hashedPassword,
        avatar: "👤",
      });
      console.log(`🔥 Seeded Master Test User (${masterEmail})!`);
    } else {
      console.log(`✅ Master Test User (${masterEmail}) verified in database.`);
    }

    // IMPORTANT: Listen using httpServer instead of app.listen!
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server & WebSockets running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

// This catches "Ctrl+C" (SIGINT) or server restarts (SIGTERM) and pauses workers safely
const gracefulShutdown = async () => {
  console.log(
    "\n🛑 Shutting down safely. Waiting for active jobs to finish...",
  );

  // Stop accepting new jobs and wait for current ones to complete
  await fanoutWorker.close();
  await emailWorker.close();
  await inAppWorker.close();

  httpServer.close(() => {
    console.log("✅ Server and workers safely closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
