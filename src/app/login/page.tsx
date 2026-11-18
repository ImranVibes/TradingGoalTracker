"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  ArrowRight,
  Delete,
  BarChart2,
} from "lucide-react";

function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [remainingAttempts, setRemainingAttempts] = useState<number>(5);
  const [maxAttempts, setMaxAttempts] = useState<number>(5);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number>(0);

  // Sanitize redirect target to prevent open redirects
  const rawNext = searchParams.get("next") || "/";
  const safeNext = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  // Check current lockout / session status on mount
  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          router.replace(safeNext);
          return;
        }
        if (typeof data.remainingAttempts === "number") {
          setRemainingAttempts(data.remainingAttempts);
        }
        if (typeof data.maxAttempts === "number") {
          setMaxAttempts(data.maxAttempts);
        }
        if (data.locked && data.retryAfterSeconds > 0) {
          setIsLocked(true);
          setRetryAfterSeconds(data.retryAfterSeconds);
        }
      })
      .catch(() => {});
  }, [router, safeNext]);

  // Live lockout countdown timer
  useEffect(() => {
    if (!isLocked || retryAfterSeconds <= 0) return;
    const timer = setInterval(() => {
      setRetryAfterSeconds((prev) => {
        if (prev <= 1) {
          setIsLocked(false);
          setRemainingAttempts(maxAttempts);
          setError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isLocked, retryAfterSeconds, maxAttempts]);

  useEffect(() => {
    if (!isLocked && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLocked]);

  const submitPin = async (pinValue: string) => {
    if (isLocked || submitting || !pinValue.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pinValue.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        window.location.href = safeNext;
        return;
      }

      if (typeof data.remainingAttempts === "number") {
        setRemainingAttempts(data.remainingAttempts);
      }
      if (data.locked) {
        setIsLocked(true);
        setRetryAfterSeconds(data.retryAfterSeconds || 900);
      }
      setError(data.error || "Incorrect PIN.");
      setPassword("");
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {
      setError("Network error verifying PIN. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitPin(password);
  };

  const handleKeypadDigit = (digit: string) => {
    if (isLocked || submitting) return;
    setPassword((prev) => {
      const next = (prev + digit).slice(0, 32);
      return next;
    });
  };

  const handleBackspace = () => {
    if (isLocked || submitting) return;
    setPassword((prev) => prev.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle Ambient Glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-sky-500/10 blur-3xl" />

      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-[#0f172a]/95 backdrop-blur-xl p-6 sm:p-7 shadow-2xl relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700/80 flex items-center justify-center text-sky-400 shadow-inner">
            {isLocked ? (
              <ShieldAlert className="w-6 h-6 text-rose-400" />
            ) : (
              <BarChart2 className="w-6 h-6 text-sky-400" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Trading Journal</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isLocked
                ? "Temporarily locked due to failed attempts"
                : "Enter your private access PIN to unlock"}
            </p>
          </div>
        </div>

        {/* Lockout Alert */}
        {isLocked ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-center space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center justify-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              Brute-Force Protection Active
            </div>
            <p className="text-xs text-rose-200/80">
              Maximum {maxAttempts} attempts reached. Try again in:
            </p>
            <div className="text-2xl font-black font-mono text-white pt-1">
              {formatCountdown(retryAfterSeconds)}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* PIN / Password Field */}
            <div className="space-y-1.5">
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  ref={inputRef}
                  type={showPassword ? "text" : "password"}
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  placeholder="Enter PIN"
                  className="w-full rounded-xl bg-[#090d16] border border-slate-700/90 pl-10 pr-10 py-2.5 text-center text-base font-mono font-bold tracking-[0.3em] text-white placeholder:tracking-normal placeholder:font-sans placeholder:font-normal placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 p-0.5 text-slate-500 hover:text-slate-300"
                  title={showPassword ? "Hide PIN" : "Show PIN"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 text-center font-medium">
                  {error}
                </div>
              )}
            </div>

            {/* Compact Numeric Keypad for Quick Touch / Mouse Unlock */}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleKeypadDigit(d)}
                  disabled={submitting}
                  className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 border border-slate-800 text-sm font-mono font-bold text-white transition-all"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPassword("")}
                disabled={submitting}
                className="py-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white transition-all"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeypadDigit("0")}
                disabled={submitting}
                className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 border border-slate-800 text-sm font-mono font-bold text-white transition-all"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                disabled={submitting}
                className="py-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all"
                title="Backspace"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting || !password.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? "Verifying..." : "Unlock Vault"}
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        {/* Brute-Force Attempts Footer */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            5-Try Lockout Guard
          </span>
          <span
            className={`font-mono font-semibold ${
              remainingAttempts <= 1
                ? "text-rose-400"
                : remainingAttempts <= 2
                ? "text-amber-400"
                : "text-slate-400"
            }`}
          >
            {remainingAttempts} / {maxAttempts} left
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-xs text-slate-400">
          Loading vault...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
