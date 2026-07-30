import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

export const useSocket = (userId: string = "") => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    // If no user ID is loaded yet, don't try to connect
    if (!userId) return;

    const socketInstance = io(SOCKET_URL);

    socketInstance.on("connect", async () => {
      setIsConnected(true);
      // 1. Tell Express who is connecting right now
      socketInstance.emit("register", userId);
      console.log(
        `⚡ WebSocket Connected & Registered Persona ID: "${userId}"`,
      );

      // 🚀 UPGRADE: Auto-Sync Missed Notifications!
      // If the user's Wi-Fi dropped, fetch what they missed while offline.
      try {
        console.log("🔄 Syncing latest notifications from database...");
        // Assumes you have a basic GET route like /api/notifications/:userId or similar
        const response = await fetch(
          `${SOCKET_URL}/api/notifications/${userId}`,
        );

        if (response.ok) {
          const data = await response.json();
          // Safely extract the array whether your API returns { data: [] } or just []
          const fetchedNotifs = Array.isArray(data)
            ? data
            : data.data || data.notifications || [];

          if (fetchedNotifs.length > 0) {
            // Replace local state with the absolute truth from the database
            setNotifications(fetchedNotifs);
            console.log(
              `✅ Successfully synced ${fetchedNotifs.length} notifications!`,
            );
          }
        }
      } catch (error) {
        console.warn(
          "⚠️ Could not sync missed notifications (API might not be mounted yet):",
          error,
        );
      }
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
      console.warn(
        "⚠️ WebSocket Disconnected! UI will update badge to Offline.",
      );
    });

    // 2. Catch EVERY real-time event the backend sends while online
    socketInstance.onAny((eventName, ...args) => {
      console.log(`📡 [Socket Listener] Caught Event: "${eventName}"`, args);

      const data = args[0] || {};

      // 3. Guarantee a 'message' property exists for Navbar.tsx to render
      let alertText = data.message;

      // If it's a price drop, format a nice readable alert
      if (!alertText && data.type === "price_drop" && data.payload) {
        alertText = `🚨 Price Drop: ${data.payload.productName} is now $${data.payload.newPrice}!`;
      } else if (!alertText) {
        alertText = "🔔 New Notification Received!";
      }

      // Construct the final object
      const formattedNotification = {
        ...data,
        message: alertText,
      };

      // Put the newest notification at the top of the array
      setNotifications((prev) => [formattedNotification, ...prev]);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.offAny(); // Clean up the global listener
      socketInstance.disconnect();
    };
  }, [userId]);

  return { socket, isConnected, notifications, setNotifications };
};
