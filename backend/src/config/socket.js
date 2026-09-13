const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { isAdminEmail } = require("../middleware/auth");

let io = null;

function getAllowedOrigins() {
  const configured = String(process.env.FRONTEND_URL || "http://localhost:5173")
    .trim()
    .replace(/\/+$/, "");
  return [configured, "http://localhost:5173"].filter(Boolean);
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (getAllowedOrigins().includes(origin)) return true;
  return (
    process.env.NODE_ENV !== "production" &&
    /^https?:\/\/localhost(?::\d+)?$/.test(origin)
  );
}

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          return callback(null, true);
        }
        return callback(
          new Error(
            "Origin is not allowed by PulseStream Socket.io CORS policy",
          ),
        );
      },
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = String(decoded.id);
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", async (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    const userId = String(socket.userId);

    // Every authenticated user gets their own private room.
    socket.join(userId);
    console.log(`👤 Socket registered for user ${userId}`);

    // Admin dashboards join a separate room for real-time metrics updates.
    try {
      const user = await User.findById(userId).select("email").lean();
      if (user && isAdminEmail(user.email)) {
        socket.join("admin-metrics");
        console.log(`📊 Admin metrics socket registered for user ${userId}`);
      }
    } catch (error) {
      console.warn("⚠️ Could not determine admin socket role:", error.message);
    }

    socket.on("disconnect", () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket.io has not been initialized yet!");
  return io;
};

/**
 * Notify connected admin dashboards that delivery metrics have changed.
 * The event intentionally contains no sensitive metric data.
 * The frontend responds by requesting the authoritative metrics from /api/analytics.
 */
const emitMetricsUpdate = () => {
  if (!io) return;
  io.to("admin-metrics").emit("metrics:update");
  console.log("📊 Socket.io: Emitted metrics:update to admin dashboards");
};

module.exports = {
  initializeSocket,
  getIO,
  emitMetricsUpdate,
};
