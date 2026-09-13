import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { fetchNotifications } from "../services/api";

const SOCKET_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000")
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

export const useSocket = (userId = "") => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const userIdRef = useRef(userId);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

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
      return undefined;
    }

    console.log(
      `[Socket] Creating connection for user ${userId} -> ${SOCKET_URL}`,
    );

    const socketInstance = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: {
        token,
      },

      // Explicit reconnection configuration.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,

      timeout: 10000,

      // Prevent an old connection from being reused incorrectly.
      forceNew: true,
    });

    const syncNotifications = async () => {
      try {
        const response = await fetchNotifications(userIdRef.current);

        const serverNotifications =
          response?.data?.data ?? response?.data ?? [];

        if (Array.isArray(serverNotifications)) {
          setNotifications(serverNotifications.slice(0, 50));
        }
      } catch (error) {
        console.warn(
          "[Socket] Could not sync saved notifications:",
          error?.response?.data?.error || error?.message || error,
        );
      }
    };

    const handleConnect = async () => {
      console.log(`[Socket] Connected: ${socketInstance.id}`);

      setIsConnected(true);

      // Re-sync persisted notifications every time the
      // socket connects or reconnects.
      await syncNotifications();
    };

    const handleConnectError = (error) => {
      console.error("[Socket] Connection error:", error?.message || error);

      setIsConnected(false);
    };

    const handleReconnectAttempt = (attempt) => {
      console.log(`[Socket] Reconnect attempt ${attempt}`);
    };

    const handleNotification = (data = {}) => {
      const notification = {
        ...data,
        ...(data.notification || {}),
        message:
          data.message ||
          data.notification?.message ||
          "New Notification Received!",
      };

      setNotifications((previous) => {
        // Avoid duplicate notifications when a socket event
        // arrives immediately after a server sync.
        const notificationId =
          notification._id ||
          notification.id ||
          notification.notification?._id ||
          null;

        if (
          notificationId &&
          previous.some(
            (item) => item._id === notificationId || item.id === notificationId,
          )
        ) {
          return previous;
        }

        return [notification, ...previous].slice(0, 50);
      });
    };

    const handleDisconnect = (reason) => {
      console.log(`[Socket] Disconnected: ${socketInstance.id} (${reason})`);

      setIsConnected(false);
    };

    const handleReconnect = async (attempt) => {
      console.log(
        `[Socket] Reconnected after ${attempt} attempt(s): ${socketInstance.id}`,
      );

      setIsConnected(true);

      // Re-sync anything that may have been emitted while
      // the browser was disconnected.
      await syncNotifications();
    };

    socketInstance.on("connect", handleConnect);
    socketInstance.on("connect_error", handleConnectError);
    socketInstance.on("reconnect_attempt", handleReconnectAttempt);
    socketInstance.on("reconnect", handleReconnect);
    socketInstance.on("notification", handleNotification);
    socketInstance.on("disconnect", handleDisconnect);

    setSocket(socketInstance);

    return () => {
      console.log(`[Socket] Cleaning up connection for user ${userId}`);

      socketInstance.off("connect", handleConnect);
      socketInstance.off("connect_error", handleConnectError);
      socketInstance.off("reconnect_attempt", handleReconnectAttempt);
      socketInstance.off("reconnect", handleReconnect);
      socketInstance.off("notification", handleNotification);
      socketInstance.off("disconnect", handleDisconnect);

      socketInstance.disconnect();
    };
  }, [userId]);

  return {
    socket,
    isConnected,
    notifications,
    setNotifications,
  };
};
