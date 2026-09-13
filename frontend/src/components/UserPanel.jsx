import { useState } from "react";
import { INITIAL_CATALOG } from "../data/catalog";
import { enableAllNotifications } from "../services/api";
import {
  Mail,
  Zap,
  ShieldCheck,
  Tag,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import { AuthPanel } from "./AuthPanel";

export const UserPanel = ({
  currentUser,
  setCurrentUser,
  onToggleWatchlist,
}) => {
  const [error, setError] = useState("");

  const getSubStatus = (productId) => {
    if (!currentUser || !Array.isArray(currentUser.subscriptions)) {
      return { inApp: false, email: false };
    }
    const subscription = currentUser.subscriptions.find(
      (s) => s.productId === productId,
    );
    return subscription || { inApp: false, email: false };
  };

  const handleToggle = async (productId, channel) => {
    if (!currentUser) return;

    const previousUser = currentUser;
    const existingSubscriptions = Array.isArray(currentUser.subscriptions)
      ? currentUser.subscriptions
      : [];

    const updatedSubscriptions = existingSubscriptions.map((subscription) =>
      subscription.productId === productId
        ? { ...subscription, [channel]: !subscription[channel] }
        : subscription,
    );

    const exists = updatedSubscriptions.some(
      (subscription) => subscription.productId === productId,
    );

    // Create a new subscription if this product doesn't exist yet.
    if (!exists) {
      updatedSubscriptions.push({
        productId,
        inApp: channel === "inApp",
        email: channel === "email",
      });
    }

    // Optimistic UI update.
    setCurrentUser({ ...currentUser, subscriptions: updatedSubscriptions });

    try {
      await onToggleWatchlist(productId, channel);
      setError("");
    } catch (err) {
      console.error("Watchlist update failed, rolling back:", err);
      setCurrentUser(previousUser);
      setError(
        "Couldn't update your watchlist. Please check that the backend is running.",
      );
    }
  };

  const handleEnableAllNotifications = async () => {
    if (!currentUser) return;
    const allProductIds = INITIAL_CATALOG.map((product) => product.id);

    try {
      const response = await enableAllNotifications(
        currentUser._id || currentUser.id,
        allProductIds,
      );
      if (response.data?.data) {
        setCurrentUser(response.data.data);
        setError("");
        alert("All notification triggers are enabled.");
      }
    } catch (err) {
      console.error("Failed to enable all notifications:", err);
      setError("Failed to enable all notification triggers.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setCurrentUser(null);
    setError("");
  };

  // Logged-out state renders AuthPanel
  if (!currentUser) {
    return <AuthPanel setCurrentUser={setCurrentUser} />;
  }

  // Logged-in UI
  return (
    <div className="space-y-8 animate-fadeIn">
      {error && (
        <div className="flex items-start bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold px-4 py-3 rounded-xl">
          <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* User Header */}
      <div className="bg-gradient-to-r from-slate-900 via-violet-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-slate-800 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <span className="text-4xl bg-slate-800 p-3 rounded-2xl border border-slate-700">
            {currentUser.avatar || "👤"}
          </span>
          <div>
            <div className="flex items-center space-x-2">
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Logged In
              </span>
            </div>
            <h1 className="text-2xl font-extrabold mt-1">{currentUser.name}</h1>
            <p className="text-slate-400 text-xs font-mono">
              {currentUser.email}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center"
        >
          <LogOut className="h-4 w-4 mr-1.5" />
          Sign Out
        </button>
      </div>

      {/* Watchlist */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-slate-800 flex items-center">
              <Tag className="h-5 w-5 mr-2 text-violet-600" />
              My Personal Watchlist
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Toggling channels below updates your cloud preferences instantly.
            </p>
          </div>

          {currentUser.isAdmin && (
            <button
              type="button"
              onClick={handleEnableAllNotifications}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-black rounded-xl shadow-lg shadow-violet-500/30 flex items-center transition-all active:scale-95"
            >
              <Zap className="h-4 w-4 mr-1.5 animate-pulse text-yellow-300" />
              ENABLE ALL ALERTS
            </button>
          )}
        </div>

        {/* Product list */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-slate-50/30">
          {INITIAL_CATALOG.map((product) => {
            const subscriptions = getSubStatus(product.id);
            const isSubscribed = subscriptions.inApp || subscriptions.email;

            return (
              <div
                key={product.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isSubscribed
                    ? "bg-white border-violet-300 shadow-md ring-1 ring-violet-500/20"
                    : "bg-white/60 border-slate-200 opacity-80 hover:opacity-100"
                }`}
              >
                {/* Product info */}
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {product.category}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full transition-all ${
                        isSubscribed
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isSubscribed ? "● Watching" : "○ Muted"}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg mt-1">
                    {product.name}
                  </h3>
                  <div className="mt-2 text-xl font-black text-slate-900">
                    ${product.price}
                  </div>
                </div>

                {/* Channels */}
                <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                  <span className="text-xs font-semibold text-slate-500 block">
                    Notification Channels:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggle(product.id, "inApp")}
                      className={`flex items-center justify-center px-3 py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                        subscriptions.inApp
                          ? "bg-violet-600 text-white border-violet-600 shadow"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <Zap className="h-3.5 w-3.5 mr-1.5" />
                      In-App Push
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(product.id, "email")}
                      className={`flex items-center justify-center px-3 py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                        subscriptions.email
                          ? "bg-purple-600 text-white border-purple-600 shadow"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <Mail className="h-3.5 w-3.5 mr-1.5" />
                      Email Alert
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
