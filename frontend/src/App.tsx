import { useState, useEffect } from "react";
import { useSocket } from "./hooks/useSocket";
import { Navbar } from "./components/Navbar";
import { AdminDashboard } from "./components/AdminDashboard";
import { UserPanel } from "./components/UserPanel";
import { updateWatchlist, fetchCurrentUser } from "./services/api";
import { Bell, Activity } from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const userId = currentUser ? currentUser._id || currentUser.id : "";
  const { isConnected, notifications, setNotifications } = useSocket(userId);
  const [activeTab, setActiveTab] = useState<"consumer" | "admin">("consumer");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setAuthChecked(true);
      return;
    }
    fetchCurrentUser()
      .then((res) => setCurrentUser(res.data.user))
      .catch(() => {
        localStorage.removeItem("token");
        setCurrentUser(null);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  const handleToggleWatchlist = async (
    productId: string,
    channel: "inApp" | "email",
  ) => {
    console.log(
      "🚨 1. UI Toggle Clicked! UserId:",
      userId,
      "Product:",
      productId,
    );

    if (!userId) {
      console.error(
        "🚨 ABORTING: No User ID found in React state! The API call was cancelled.",
      );
      return;
    }

    try {
      console.log("🚨 2. Firing Axios Request to Backend...");
      const res = await updateWatchlist(userId, productId, channel);
      console.log("🚨 3. Backend Response Received:", res.data);
      if (res.data && res.data.data) {
        setCurrentUser(res.data.data);
      }
    } catch (err) {
      console.error("🚨 4. Failed to update MongoDB:", err);
      throw err;
    }
  };

  const handleClearNotifications = async () => {
    if (!userId) return;

    // 1. Instantly clear the UI so it feels fast for the user (Optimistic UI)
    setNotifications([]);

    // 2. Tell MongoDB to permanently delete them
    try {
      const backendUrl =
        import.meta.env.VITE_API_URL || "http://localhost:5000";
      await fetch(`${backendUrl}/api/notifications/clear/${userId}`, {
        method: "DELETE",
      });
      console.log("✅ Notifications permanently deleted from MongoDB!");
    } catch (error) {
      console.error("❌ Failed to delete notifications from database", error);
    }
  };

  const isAdmin =
    currentUser?.email === "nikhileshkumar317@gmail.com" ||
    currentUser?.email === "test@pulsestream.io";

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm font-medium">
        Loading session...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        isConnected={isConnected}
        notifications={notifications}
        onClearNotifications={handleClearNotifications}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
      />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "admin" && isAdmin ? (
          <AdminDashboard />
        ) : (
          <div className="max-w-5xl mx-auto space-y-10 animate-fadeIn">
            <UserPanel
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
              onToggleWatchlist={handleToggleWatchlist}
            />

            {currentUser && (
              <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-800 flex items-center">
                      <Bell className="h-6 w-6 mr-2.5 text-indigo-600 animate-pulse" />{" "}
                      Live Notification Inbox
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Real-time alerts broadcasted to {currentUser.name} appear
                      here instantly.
                    </p>
                  </div>
                  <span className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold px-3 py-1 rounded-full">
                    Port 5000 Active
                  </span>
                </div>

                {notifications.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <Activity className="h-12 w-12 mx-auto mb-3 text-indigo-400/30 animate-pulse" />
                    <p className="font-bold text-slate-600 text-base">
                      No real-time alerts received yet.
                    </p>
                    <p className="text-xs mt-1 text-slate-400">
                      Switch to Admin and drop a price on an item{" "}
                      {currentUser.name} is watching!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {notifications.map((notif, index) => (
                      <div
                        key={index}
                        className="bg-indigo-50/80 border-l-4 border-indigo-600 p-5 rounded-r-xl shadow-sm flex justify-between"
                      >
                        <div>
                          <span className="text-[11px] font-extrabold text-indigo-600 uppercase bg-indigo-100 px-2 py-0.5 rounded">
                            ⚡ Push Alert
                          </span>
                          <h3 className="font-extrabold text-slate-900 text-lg mt-2">
                            {notif.message}
                          </h3>
                        </div>
                        <span className="text-xs font-semibold text-slate-400 bg-white px-2 py-1 rounded border">
                          Just now
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
