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

    socketInstance.on("connect", () => {
      setIsConnected(true);
      // 1. Tell Express who is connecting right now!
      socketInstance.emit("register", userId);
      console.log(
        `⚡ WebSocket Connected & Registered Persona ID: "${userId}"`,
      );
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    // 2. 🐛 THE FIX: Catch EVERY event the backend sends, regardless of the name
    socketInstance.onAny((eventName, ...args) => {
      console.log(`📡 [Socket Listener] Caught Event: "${eventName}"`, args);

      const data = args[0] || {};

      // 3. 🐛 THE FIX: Guarantee a 'message' property exists for App.tsx to render
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
