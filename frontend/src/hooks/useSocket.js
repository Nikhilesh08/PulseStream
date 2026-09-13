import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { fetchNotifications } from "../services/api";

const SOCKET_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000")
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

export const useSocket = (userId = "") => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!userId) {
      setSocket(null);
      setIsConnected(false);
      setNotifications([]);
      return undefined;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setSocket(null);
      setIsConnected(false);
      setNotifications([]);
      return undefined;
    }

    const socketInstance = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { token },
    });

    const handleConnect = async () => {
      setIsConnected(true);
      try {
        const response = await fetchNotifications(userId);
        const fetchedNotifs = response.data?.data;
        if (Array.isArray(fetchedNotifs)) {
          setNotifications(fetchedNotifs);
        }
      } catch (error) {
        console.warn(
          "⚠️ Could not sync saved notifications:",
          error?.message || error,
        );
      }
    };

    const handleNotification = (data = {}) => {
      const notification = {
        ...data,
        ...(data.notification || {}),
        message:
          data.message ||
          data.notification?.message ||
          "🔔 New Notification Received!",
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
    };

    const handleMetricsUpdate = () => {
      // AdminDashboard listens for this browser event and immediately fetches the authoritative metrics from /api/analytics.
      window.dispatchEvent(new Event("pulsestream:metrics-update"));
    };

    const handleDisconnect = () => setIsConnected(false);

    socketInstance.on("connect", handleConnect);
    socketInstance.on("notification", handleNotification);
    socketInstance.on("metrics:update", handleMetricsUpdate);
    socketInstance.on("disconnect", handleDisconnect);

    setSocket(socketInstance);

    return () => {
      socketInstance.off("connect", handleConnect);
      socketInstance.off("notification", handleNotification);
      socketInstance.off("metrics:update", handleMetricsUpdate);
      socketInstance.off("disconnect", handleDisconnect);
      socketInstance.disconnect();
    };
  }, [userId]);

  return { socket, isConnected, notifications, setNotifications };
};
