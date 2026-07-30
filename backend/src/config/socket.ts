import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";

let io: Server | null = null;

export const initializeSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      // UPDATED: Accepts an array so both local development and Vercel production work automatically!
      origin: [process.env.FRONTEND_URL || "", "http://localhost:5173"],
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
      credentials: true,
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(
      `🔌 [Socket.io]: New browser connected (Socket ID: ${socket.id})`,
    );

    // When the frontend React app connects, it emits: socket.emit('register', userId)
    socket.on("register", (userId: string) => {
      if (userId) {
        // Enterprise Best Practice: Use Socket.io Rooms instead of manual Maps!
        // This automatically handles multi-tab browsing without overwriting socket IDs.
        socket.join(userId);
        console.log(
          `👤 [Socket.io]: Registered User ID "${userId}" to Socket Room "${userId}"`,
        );
      }
    });

    // Handle user disconnecting (closing browser tab)
    socket.on("disconnect", () => {
      console.log(
        `❌ [Socket.io]: Browser disconnected (Socket ID: ${socket.id})`,
      );
    });
  });

  return io;
};

// 1. CRITICAL EXPORT: Required by inapp.worker.ts so it doesn't throw ts(2305)!
export const getIO = (): Server => {
  if (!io) {
    throw new Error("Socket.io has not been initialized yet!");
  }
  return io;
};

// 2. Helper function so our workers/routes can check if a user is online and send an alert!
export const sendLiveNotification = (userId: string, payload: any): boolean => {
  if (!io) return false;

  // Check if the user currently has any active sockets joined to their room
  const room = io.sockets.adapter.rooms.get(userId);
  if (room && room.size > 0) {
    // User is online! Beam the notification directly to all their open browser tabs
    io.to(userId).emit("new_notification", payload);
    console.log(
      `⚡ [Socket.io]: Live alert beamed to online User ID "${userId}"!`,
    );
    return true;
  }

  // User is offline (they will still see it in their inbox when they log in later)
  return false;
};
