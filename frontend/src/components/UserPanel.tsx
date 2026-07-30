import React, { useState } from "react";
import axios from "axios";
import { INITIAL_CATALOG } from "../data/catalog";
import { loginUser, signupUser, armMasterUser } from "../services/api";
import {
  Mail,
  Zap,
  ShieldCheck,
  Tag,
  LogOut,
  LogIn,
  UserPlus,
  KeyRound,
  ArrowLeft,
} from "lucide-react";

interface UserPanelProps {
  currentUser: any | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<any | null>>;
  onToggleWatchlist: (
    productId: string,
    channel: "inApp" | "email",
  ) => Promise<void>;
}

export const UserPanel: React.FC<UserPanelProps> = ({
  currentUser,
  setCurrentUser,
  onToggleWatchlist,
}) => {
  // 🚀 UPGRADE: State Machine for Auth Views
  type AuthView = "login" | "signup" | "forgot" | "reset";
  const [view, setView] = useState<AuthView>("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Standard Login / Signup
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res =
        view === "signup"
          ? await signupUser(name, email, password)
          : await loginUser(email, password);
      localStorage.setItem("token", res.data.token);
      setCurrentUser(res.data.user);
    } catch (err: any) {
      setError(err.response?.data?.error || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password Request
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await axios.post("http://localhost:5000/api/auth/forgot-password", {
        email,
      });
      setSuccessMsg(
        "If an account exists, a recovery code was sent to your email.",
      );
      setView("reset"); // Push them to the reset screen automatically
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  // Execute Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await axios.post("http://localhost:5000/api/auth/reset-password", {
        token: resetToken,
        newPassword: password,
      });
      setSuccessMsg("Password updated successfully! Please log in.");
      setView("login");
      setPassword("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Invalid or expired token.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setCurrentUser(null);
    setView("login");
  };

  // Watchlist & God Mode logic remains completely untouched
  const getSubStatus = (productId: string) => {
    if (!currentUser || !Array.isArray(currentUser.subscriptions)) {
      return { inApp: false, email: false };
    }
    const sub = currentUser.subscriptions.find(
      (s: any) => s.productId === productId,
    );
    return sub || { inApp: false, email: false };
  };

  const handleToggle = async (
    productId: string,
    channel: "inApp" | "email",
  ) => {
    if (!currentUser) return;
    const previousUser = currentUser;
    const safeSubscriptions = Array.isArray(currentUser.subscriptions)
      ? currentUser.subscriptions
      : [];
    const currentSubs = safeSubscriptions.map((s: any) =>
      s.productId === productId ? { ...s, [channel]: !s[channel] } : s,
    );
    const exists = currentSubs.some((s: any) => s.productId === productId);
    if (!exists) {
      currentSubs.push({
        productId,
        inApp: channel === "inApp",
        email: channel === "email",
      });
    }
    setCurrentUser({ ...currentUser, subscriptions: currentSubs });
    try {
      await onToggleWatchlist(productId, channel);
    } catch (err) {
      console.error("Watchlist update failed, rolling back:", err);
      setCurrentUser(previousUser);
    }
  };

  const handleGodMode = async () => {
    if (!currentUser) return;
    const allProductIds = INITIAL_CATALOG.map((p) => p.id);
    try {
      const res = await armMasterUser(
        currentUser._id || currentUser.id,
        allProductIds,
      );
      if (res.data && res.data.data) {
        setCurrentUser(res.data.data);
        alert("🚀 GOD MODE ACTIVATED: All triggers armed!");
      }
    } catch (err) {
      alert("❌ Failed to activate God Mode.");
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl border border-slate-200 mt-10 animate-fadeIn">
        <h2 className="text-2xl font-black text-slate-800 text-center flex items-center justify-center">
          {view === "signup" && (
            <UserPlus className="mr-2 h-6 w-6 text-indigo-600" />
          )}
          {view === "login" && (
            <LogIn className="mr-2 h-6 w-6 text-indigo-600" />
          )}
          {(view === "forgot" || view === "reset") && (
            <KeyRound className="mr-2 h-6 w-6 text-indigo-600" />
          )}

          {view === "signup" && "Create Account"}
          {view === "login" && "Sign In to Watchlist"}
          {view === "forgot" && "Recover Account"}
          {view === "reset" && "Set New Password"}
        </h2>

        <p className="text-xs text-slate-500 text-center mt-1 mb-4">
          {view === "forgot"
            ? "Enter your email to receive a secure recovery code."
            : view === "reset"
              ? "Enter the code sent to your email and a new password."
              : "Real MERN authentication with bcrypt password hashing"}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs rounded-lg border border-rose-200 font-bold text-center animate-shake">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-200 font-bold text-center">
            {successMsg}
          </div>
        )}

        {/* FORGOT PASSWORD FORM */}
        {view === "forgot" && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="user@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-all disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Recovery Code"}
            </button>
          </form>
        )}

        {/* RESET PASSWORD FORM */}
        {view === "reset" && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Recovery Code (from email)
              </label>
              <input
                type="text"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                placeholder="Paste code here..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">
                New Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm transition-all disabled:opacity-50"
            >
              {loading ? "Updating..." : "Confirm New Password"}
            </button>
          </form>
        )}

        {/* LOGIN / SIGNUP FORM */}
        {(view === "login" || view === "signup") && (
          <form onSubmit={handleAuth} className="space-y-4">
            {view === "signup" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="John Doe"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Password
                </label>
                {view === "login" && (
                  <button
                    type="button"
                    onClick={() => setView("forgot")}
                    className="text-[10px] text-indigo-600 hover:underline font-bold"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-all disabled:opacity-50"
            >
              {loading
                ? "Processing..."
                : view === "signup"
                  ? "Sign Up Now"
                  : "Sign In"}
            </button>
          </form>
        )}

        {/* NAVIGATION LINKS */}
        <div className="mt-6 text-center flex flex-col space-y-2">
          {view === "forgot" || view === "reset" ? (
            <button
              onClick={() => setView("login")}
              className="text-xs text-slate-500 font-bold hover:text-slate-800 flex items-center justify-center"
            >
              <ArrowLeft className="h-3 w-3 mr-1" /> Back to Login
            </button>
          ) : (
            <button
              onClick={() => setView(view === "signup" ? "login" : "signup")}
              className="text-xs text-indigo-600 font-bold hover:underline"
            >
              {view === "signup"
                ? "Already have an account? Sign In"
                : "Need an account? Sign Up"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- LOGGED IN USER INTERFACE ---
  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-slate-800 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <span className="text-4xl bg-slate-800 p-3 rounded-2xl border border-slate-700">
            {currentUser.avatar || "👤"}
          </span>
          <div>
            <div className="flex items-center space-x-2">
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center">
                <ShieldCheck className="h-3 w-3 mr-1" /> Logged In
              </span>
            </div>
            <h1 className="text-2xl font-extrabold mt-1">{currentUser.name}</h1>
            <p className="text-slate-400 text-xs font-mono">
              {currentUser.email}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center"
        >
          <LogOut className="h-4 w-4 mr-1.5" /> Sign Out
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-slate-800 flex items-center">
              <Tag className="h-5 w-5 mr-2 text-indigo-600" /> My Personal
              Watchlist
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Toggling channels below updates your cloud preferences instantly.
            </p>
          </div>

          {currentUser.email === "nikhileshkumar317@gmail.com" && (
            <button
              onClick={handleGodMode}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black rounded-lg shadow-lg shadow-indigo-500/30 flex items-center transition-all active:scale-95"
            >
              <Zap className="h-4 w-4 mr-1.5 animate-pulse text-yellow-300" />
              ARM ALL TRIGGERS
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-slate-50/30">
          {INITIAL_CATALOG.map((product) => {
            const subs = getSubStatus(product.id);
            const isSubscribed = subs.inApp || subs.email;

            return (
              <div
                key={product.id}
                className={`p-5 rounded-xl border transition-all flex flex-col justify-between ${
                  isSubscribed
                    ? "bg-white border-indigo-300 shadow-md ring-1 ring-indigo-500/20"
                    : "bg-white/60 border-slate-200 opacity-80 hover:opacity-100"
                }`}
              >
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

                <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                  <span className="text-xs font-semibold text-slate-500 block">
                    Notification Channels:
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleToggle(product.id, "inApp")}
                      type="button"
                      className={`flex items-center justify-center px-3 py-2 rounded-lg border text-xs font-semibold transition-all active:scale-95 ${
                        subs.inApp
                          ? "bg-indigo-600 text-white border-indigo-600 shadow"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <Zap className="h-3.5 w-3.5 mr-1.5" />
                      In-App Push
                    </button>

                    <button
                      onClick={() => handleToggle(product.id, "email")}
                      type="button"
                      className={`flex items-center justify-center px-3 py-2 rounded-lg border text-xs font-semibold transition-all active:scale-95 ${
                        subs.email
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
