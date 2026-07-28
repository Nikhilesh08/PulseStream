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

interface NavbarProps {
  isConnected: boolean;
  notifications: any[];
  onClearNotifications: () => void;
  activeTab: "consumer" | "admin";
  setActiveTab: (tab: "consumer" | "admin") => void;
  currentUser: any | null; // <-- Added currentUser prop for Role-Based Access Control!
}

export const Navbar = ({
  isConnected,
  notifications,
  onClearNotifications,
  activeTab,
  setActiveTab,
  currentUser,
}: NavbarProps) => {
  const [showDrawer, setShowDrawer] = useState(false);

  return (
    <nav className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2 rounded-xl shadow-lg shadow-blue-500/20">
              <Activity className="h-6 w-6 text-white animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                PulseStream<span className="text-blue-500 font-black">.io</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] bg-slate-800 border border-slate-700 text-slate-300 font-mono px-2 py-0.5 rounded-full">
                MERN + BullMQ + WebSockets
              </span>
            </div>
          </div>

          {/* View Switcher Tabs */}
          <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setActiveTab("consumer")}
              className={`flex items-center px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "consumer"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
              Shopper Portal
            </button>

            {/* RBAC LOCKDOWN: Only render Admin Command Center if logged in as Master Test Admin! */}
            {currentUser && currentUser.email === "test@pulsestream.io" && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`flex items-center px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "admin"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                Admin Command Center
              </button>
            )}
          </div>

          {/* Right Controls: WiFi Health & Notification Bell */}
          <div className="flex items-center space-x-4">
            {/* Real-time Connection Badge */}
            <div
              className={`flex items-center px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                isConnected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-2xs shadow-emerald-500/10"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse"
              }`}
            >
              {isConnected ? (
                <>
                  <Wifi className="h-3.5 w-3.5 mr-1.5" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 mr-1.5" />
                  <span>Offline</span>
                </>
              )}
            </div>

            {/* Notification Bell Dropdown Button */}
            <div className="relative">
              <button
                onClick={() => setShowDrawer(!showDrawer)}
                className="relative p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all active:scale-95"
              >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow-md">
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Drawer */}
              {showDrawer && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-slideIn">
                  <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center">
                    <span className="font-extrabold text-sm text-white flex items-center">
                      <Bell className="h-4 w-4 mr-2 text-blue-400" /> Recent
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
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear All
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-800 p-2 space-y-2">
                    {notifications.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 text-xs font-medium">
                        🎉 No unread notifications right now.
                      </div>
                    ) : (
                      notifications.map((notif, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-all border border-slate-700/50"
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider bg-blue-500/10 px-1.5 py-0.5 rounded">
                              ⚡ Instant Push
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Just now
                            </span>
                          </div>
                          <p className="font-bold text-sm text-slate-200 mt-1">
                            {notif.message}
                          </p>
                          {notif.payload && (
                            <div className="mt-1.5 text-xs text-emerald-400 font-mono bg-slate-900/80 p-1.5 rounded border border-slate-800">
                              New Price: ${notif.payload.newPrice}{" "}
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
