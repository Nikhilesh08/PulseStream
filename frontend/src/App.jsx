import { useState, useEffect } from "react";
import { useSocket } from "./hooks/useSocket";
import { Navbar } from "./components/Navbar";
import { AdminDashboard } from "./components/AdminDashboard";
import { UserPanel } from "./components/UserPanel";
import { updateWatchlist, fetchCurrentUser, clearNotifications } from "./services/api";
import { Bell, Activity } from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const userId = currentUser ? currentUser._id || currentUser.id : "";
  const { isConnected, notifications, setNotifications } = useSocket(userId);
  const [activeTab, setActiveTab] = useState("consumer");

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

  const handleToggleWatchlist = async (productId, channel) => {
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

    const previousNotifications = notifications;
    setNotifications([]);

    try {
      await clearNotifications(userId);
    } catch (error) {
      console.error("❌ Failed to delete notifications from database", error);
      setNotifications(previousNotifications);
    }
  };

  const isAdmin = Boolean(currentUser?.isAdmin);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm font-medium">
        Loading session...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        isConnected={isConnected}
        notifications={notifications}
        onClearNotifications={handleClearNotifications}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
      />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {activeTab === "admin" && isAdmin ? (
          <AdminDashboard />
        ) : (
          <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
            <UserPanel
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
              onToggleWatchlist={handleToggleWatchlist}
            />

            {currentUser && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 p-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center">
                      <span className="bg-violet-50 text-violet-600 p-1.5 rounded-lg mr-2.5">
                        <Bell className="h-4 w-4" />
                      </span>
                      Live Notification Inbox
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 ml-9">
                      Real-time alerts broadcast to {currentUser.name} appear
                      here instantly.
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                      isConnected
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-rose-50 border-rose-200 text-rose-700"
                    }`}
                  >
                    {isConnected ? "● Live" : "○ Offline"}
                  </span>
                </div>

                {notifications.length === 0 ? (
                  <div className="text-center py-14 text-slate-400 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                    <Activity className="h-10 w-10 mx-auto mb-3 text-violet-300" />
                    <p className="font-semibold text-slate-600 text-sm">
                      No real-time alerts received yet.
                    </p>
                    <p className="text-xs mt-1 text-slate-400">
                      Switch to Admin and drop a price on an item{" "}
                      {currentUser.name} is watching.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notif, index) => (
                      <div
                        key={index}
                        className="bg-violet-50/60 border-l-4 border-violet-500 p-4 rounded-r-xl flex justify-between items-start gap-3"
                      >
                        <div>
                          <span className="text-[10px] font-bold text-violet-600 uppercase bg-violet-100 px-2 py-0.5 rounded">
                            Push Alert
                          </span>
                          <h3 className="font-bold text-slate-900 text-base mt-1.5">
                            {notif.message}
                          </h3>
                        </div>
                        <span className="text-[11px] font-medium text-slate-400 bg-white px-2 py-1 rounded-full border border-slate-200 shrink-0">
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
