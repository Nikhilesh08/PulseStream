import { useState } from "react";
import {
  loginUser,
  signupUser,
  forgotPassword,
  resetPassword,
} from "../services/api";
import {
  KeyRound,
  ArrowLeft,
  AlertTriangle,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
} from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (value) => {
  const email = String(value || "")
    .trim()
    .toLowerCase();
  if (!email) return "Email address is required";
  if (!EMAIL_REGEX.test(email)) return "Please enter a valid email address";
  return null;
};

const validatePassword = (value) => {
  const password = String(value || "");
  if (password.length < 8) return "Password must be at least 8 characters long";
  if (!/[A-Z]/.test(password))
    return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password))
    return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(password))
    return "Password must contain at least one number";
  return null;
};

const getPasswordStrength = (password) => {
  const value = String(password || "");
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[a-z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;

  if (score <= 2) return "Weak";
  if (score <= 4) return "Medium";
  return "Strong";
};

const PasswordRequirements = ({ password, showStrength = false }) => {
  const value = String(password || "");
  const requirements = [
    { label: "8+ characters", valid: value.length >= 8 },
    { label: "Uppercase letter", valid: /[A-Z]/.test(value) },
    { label: "Lowercase letter", valid: /[a-z]/.test(value) },
    { label: "Number", valid: /[0-9]/.test(value) },
  ];

  const strength = getPasswordStrength(value);

  return (
    <div className="mt-2 space-y-1">
      {requirements.map((requirement) => (
        <div
          key={requirement.label}
          className={`text-[10px] font-semibold ${
            requirement.valid ? "text-emerald-600" : "text-slate-400"
          }`}
        >
          {requirement.valid ? "✓" : "○"} {requirement.label}
        </div>
      ))}

      {showStrength && value && (
        <div
          className={`text-[10px] font-bold pt-1 ${
            strength === "Strong"
              ? "text-emerald-600"
              : strength === "Medium"
                ? "text-amber-600"
                : "text-rose-600"
          }`}
        >
          Password strength: {strength}
        </div>
      )}
    </div>
  );
};

export const AuthPanel = ({ setCurrentUser }) => {
  const [view, setView] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const normalizedEmail = email.trim().toLowerCase();
    const emailError = validateEmail(normalizedEmail);
    if (emailError) {
      setError(emailError);
      return;
    }

    if (view === "signup") {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setError("Full name is required");
        return;
      }
      if (trimmedName.length < 2) {
        setError("Name must be at least 2 characters long");
        return;
      }
      if (trimmedName.length > 100) {
        setError("Name must be 100 characters or fewer");
        return;
      }
      const passwordError = validatePassword(password);
      if (passwordError) {
        setError(passwordError);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    if (view === "login" && !password) {
      setError("Password is required");
      return;
    }

    setLoading(true);

    try {
      const response =
        view === "signup"
          ? await signupUser(name.trim(), normalizedEmail, password)
          : await loginUser(normalizedEmail, password);

      localStorage.setItem("token", response.data.token);
      setCurrentUser(response.data.user);

      setPassword("");
      setConfirmPassword("");
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const normalizedEmail = email.trim().toLowerCase();
    const emailError = validateEmail(normalizedEmail);

    if (emailError) {
      setError(emailError);
      return;
    }

    setLoading(true);

    try {
      const response = await forgotPassword(normalizedEmail);
      const devResetToken = response.data?.devResetToken;

      if (devResetToken) {
        setResetToken(devResetToken);
        setSuccessMsg(
          "SMTP is not configured locally. A development reset code was auto-filled below.",
        );
      } else {
        setSuccessMsg(
          "If an account exists, a recovery code was sent to your email.",
        );
      }

      setView("reset");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!resetToken.trim()) {
      setError("Recovery code is required");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      await resetPassword(resetToken.trim(), password);
      setSuccessMsg("Password updated successfully! Please log in.");
      setView("login");
      setPassword("");
      setConfirmPassword("");
      setResetToken("");
      setShowResetPassword(false);
    } catch (err) {
      setError(err.response?.data?.error || "Invalid or expired token.");
    } finally {
      setLoading(false);
    }
  };

  const switchAuthView = (nextView) => {
    setView(nextView);
    setError("");
    setSuccessMsg("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowResetPassword(false);
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl border border-slate-200/70 mt-10 animate-fadeIn">
      <h2 className="text-2xl font-black text-slate-800 text-center flex items-center justify-center">
        {view === "signup" && (
          <UserPlus className="mr-2 h-6 w-6 text-violet-600" />
        )}
        {view === "login" && <LogIn className="mr-2 h-6 w-6 text-violet-600" />}
        {(view === "forgot" || view === "reset") && (
          <KeyRound className="mr-2 h-6 w-6 text-violet-600" />
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
            ? "Enter the recovery code and create a strong new password."
            : "Secure MERN authentication with bcrypt password hashing"}
      </p>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs rounded-lg border border-rose-200 font-bold text-center animate-shake">
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-200 font-bold text-center">
          {successMsg}
        </div>
      )}

      {view === "forgot" && (
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">
              Email Address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none"
              placeholder="user@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg text-sm transition-all disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Recovery Code"}
          </button>
        </form>
      )}

      {view === "reset" && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">
              Recovery Code
            </label>
            <input
              type="text"
              required
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none font-mono"
              placeholder="Paste code here..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">
              New Password
            </label>
            <div className="relative mt-1">
              <input
                type={showResetPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowResetPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label={
                  showResetPassword ? "Hide password" : "Show password"
                }
              >
                {showResetPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <PasswordRequirements password={password} showStrength />
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
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none"
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
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none"
              placeholder="user@example.com"
            />
            {email && !validateEmail(email) && (
              <p className="text-[10px] text-emerald-600 mt-1 font-semibold">
                Valid email format
              </p>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Password
              </label>
              {view === "login" && (
                <button
                  type="button"
                  onClick={() => switchAuthView("forgot")}
                  className="text-[10px] text-violet-600 hover:underline font-bold"
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete={
                  view === "signup" ? "new-password" : "current-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {view === "signup" && (
              <PasswordRequirements password={password} showStrength />
            )}
          </div>

          {view === "signup" && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Confirm Password
              </label>
              <div className="relative mt-1">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-[11px] text-rose-600 mt-1 font-semibold">
                  Passwords do not match
                </p>
              )}
              {confirmPassword && password === confirmPassword && (
                <p className="text-[11px] text-emerald-600 mt-1 font-semibold">
                  Passwords match
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg text-sm transition-all disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : view === "signup"
                ? "Sign Up Now"
                : "Sign In"}
          </button>
        </form>
      )}

      <div className="mt-6 text-center flex flex-col space-y-2">
        {view === "forgot" || view === "reset" ? (
          <button
            type="button"
            onClick={() => switchAuthView("login")}
            className="text-xs text-slate-500 font-bold hover:text-slate-800 flex items-center justify-center"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Back to Login
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              switchAuthView(view === "signup" ? "login" : "signup")
            }
            className="text-xs text-violet-600 font-bold hover:underline"
          >
            {view === "signup"
              ? "Already have an account? Sign In"
              : "Need an account? Sign Up"}
          </button>
        )}
      </div>
    </div>
  );
};
