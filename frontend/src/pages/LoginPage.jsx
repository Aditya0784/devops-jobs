import { useState, useEffect, useCallback } from "react";
import { Lock, RefreshCw, Eye, EyeOff } from "lucide-react";
import { API } from "@/lib/api";
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// ── Math CAPTCHA generator ─────────────────────────────────────────────────
function makeCaptcha() {
  const ops = ["+", "-", "×"];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b, answer;
  if (op === "+") {
    a = Math.floor(Math.random() * 20) + 1;
    b = Math.floor(Math.random() * 20) + 1;
    answer = a + b;
  } else if (op === "-") {
    a = Math.floor(Math.random() * 20) + 10;
    b = Math.floor(Math.random() * 10) + 1;
    answer = a - b;
  } else {
    a = Math.floor(Math.random() * 9) + 2;
    b = Math.floor(Math.random() * 9) + 2;
    answer = a * b;
  }
  return { question: `${a} ${op} ${b} = ?`, answer: String(answer) };
}

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [captcha, setCaptcha] = useState(() => makeCaptcha());
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => {
      const left = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (left <= 0) {
        setLockedUntil(null);
        setCountdown(0);
        setAttempts(0);
        refreshCaptcha();
      } else {
        setCountdown(left);
      }
    }, 500);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const refreshCaptcha = useCallback(() => {
    setCaptcha(makeCaptcha());
    setCaptchaInput("");
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const attempt = async () => {
    if (lockedUntil) return;

    // Basic validation
    if (!username.trim()) return setError("Enter Your Username");
    if (!password.trim()) return setError("Enter Your Password");
    if (!captchaInput.trim()) return setError("Solve the CAPTCHA");

    // CAPTCHA check
    if (captchaInput.trim() !== captcha.answer) {
      triggerShake();
      setError("❌ CAPTCHA is incorrect");
      refreshCaptcha();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem("ajt_token", data.token);
        sessionStorage.setItem("ajt_user", data.username);
        onLogin(data.username);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        refreshCaptcha();
        triggerShake();

        if (newAttempts >= 3) {
          // 60 second lockout after 3 failed attempts
          setLockedUntil(Date.now() + 60_000);
          setError("3 failed attempts — locked for 60 seconds");
        } else {
          setError(`❌ Incorrect username or password (${3 - newAttempts} attempts remaining)`);
        }
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const isLocked = !!lockedUntil;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-4">
      <div
        className="w-full max-w-sm"
        style={shake ? { animation: "shake 0.4s ease-in-out" } : {}}
      >
        {/* Header */}
        <div className="border border-zinc-800 bg-zinc-900/60 p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 border border-zinc-700 bg-zinc-800 flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <div className="font-semibold tracking-tight">AdityaJobTool</div>
              <div className="text-[10px] font-mono text-zinc-500">DevOps · SRE · Cloud Arch</div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                disabled={isLocked}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && attempt()}
                placeholder="Enter your username"
                autoFocus
                className="w-full bg-zinc-950 border border-zinc-700 px-3 py-2.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors disabled:opacity-40"
              />
            </div>

              {/* Password */}
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  disabled={isLocked}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && attempt()}
                  placeholder="••••••••"
                  className="w-full bg-zinc-950 border border-zinc-700 px-3 py-2.5 pr-10 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-emerald-400 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* CAPTCHA */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono">
                  CAPTCHA
                </label>
                <button
                  type="button"
                  onClick={refreshCaptcha}
                  disabled={isLocked}
                  className="text-zinc-600 hover:text-emerald-400 transition-colors disabled:opacity-40"
                  title="Naya CAPTCHA"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
              <div className="bg-zinc-950 border border-zinc-700 px-4 py-3 mb-2 text-center">
                <span className="font-mono text-lg text-emerald-400 tracking-widest select-none">
                  {captcha.question}
                </span>
              </div>
              <input
                type="number"
                value={captchaInput}
                disabled={isLocked}
                onChange={(e) => { setCaptchaInput(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && attempt()}
                placeholder="Solve the answer"
                className="w-full bg-zinc-950 border border-zinc-700 px-3 py-2.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors disabled:opacity-40"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="text-xs text-rose-400 font-mono bg-rose-500/10 border border-rose-500/20 px-3 py-2">
                {error}
              </div>
            )}

            {/* Lockout timer */}
            {isLocked && (
              <div className="text-xs text-amber-400 font-mono bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-center">
                🔒 {countdown} seconds mein try kar sakte ho
              </div>
            )}

            {/* Submit */}
            <button
              onClick={attempt}
              disabled={loading || isLocked}
              className="w-full bg-emerald-500 text-zinc-950 font-medium text-sm py-2.5 hover:bg-emerald-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Login"
              )}
            </button>
          </div>
        </div>

        {/* Attempt counter */}
        {attempts > 0 && !isLocked && (
          <div className="mt-2 text-center text-[10px] font-mono text-zinc-600">
            {attempts} failed attempt{attempts > 1 ? "s" : ""}
          </div>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
      `}</style>
    </div>
  );
}
