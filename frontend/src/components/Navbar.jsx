import { useState } from "react";
import {
  Activity,
  Bell,
  Shield,
  ShoppingBag,
  Wifi,
  WifiOff,
  Trash2,
} from "lucide-react";

export const Navbar = ({
  isConnected,
  notifications,
  onClearNotifications,
  activeTab,
  setActiveTab,
  currentUser,
}) => {
  const [showDrawer, setShowDrawer] = useState(false);

  return (
    <nav className="bg-slate-950/95 backdrop-blur border-b border-white/5 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="bg-gradient-to-br from-violet-500 to-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-950/40">
              <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="hidden sm:block">
              <span className="font-extrabold text-lg tracking-tight text-white">
                PulseStream<span className="text-violet-400">.io</span>
              </span>
              <div className="text-[10px] text-slate-500 font-medium -mt-0.5">
                MERN · BullMQ · WebSockets
              </div>
            </div>
          </div>

          {/* View Switcher Tabs */}
          <div className="flex bg-white/[0.04] p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab("consumer")}
              className={`flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeTab === "consumer"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Shopper Portal</span>
              <span className="sm:hidden">Shop</span>
            </button>

            {/* Admin Center is rendered only for users marked as admins by the backend. */}
            {currentUser?.isAdmin && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  activeTab === "admin"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">Admin Center</span>
                <span className="sm:hidden">Admin</span>
              </button>
            )}
          </div>

          {/* Right Controls: WiFi Health & Notification Bell */}
          <div className="flex items-center space-x-3 shrink-0">
            {/* Real-time Connection Badge */}
            <div
              className={`hidden sm:flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                isConnected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse"
              }`}
            >
              {isConnected ? (
                <>
                  <Wifi className="h-3 w-3 mr-1.5" />
                  <span>Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 mr-1.5" />
                  <span>Offline</span>
                </>
              )}
            </div>

            {/* Notification Bell Dropdown Button */}
            <div className="relative">
              <button
                onClick={() => setShowDrawer(!showDrawer)}
                className="relative p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl border border-white/10 transition-all active:scale-95"
              >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-slate-950">
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Drawer */}
              {showDrawer && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden animate-slideIn">
                  <div className="p-4 bg-white/[0.03] border-b border-white/5 flex justify-between items-center">
                    <span className="font-bold text-sm text-white flex items-center">
                      <Bell className="h-4 w-4 mr-2 text-violet-400" /> Recent
                      Alerts
                    </span>
                    {notifications.length > 0 && (
                      <button
                        onClick={() => {
                          onClearNotifications();
                          setShowDrawer(false);
                        }}
                        className="text-xs text-rose-400 hover:text-rose-300 flex items-center font-semibold"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto p-2 space-y-1.5">
                    {notifications.length === 0 ? (
                      <div className="text-center py-10 text-slate-500 text-xs font-medium">
                        No unread notifications yet.
                      </div>
                    ) : (
                      notifications.map((notif, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl transition-colors border border-white/5"
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">
                              Instant Push
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Just now
                            </span>
                          </div>
                          <p className="font-semibold text-sm text-slate-200 mt-1">
                            {notif.message}
                          </p>
                          {notif.payload && (
                            <div className="mt-1.5 text-xs text-emerald-400 font-mono bg-black/30 p-1.5 rounded border border-white/5">
                              ${notif.payload.newPrice}{" "}
                              <span className="text-slate-500 line-through">
                                ${notif.payload.oldPrice}
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
