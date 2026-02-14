"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Script from "next/script";

export default function LoginPage() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState<number>(0);
  const router = useRouter();
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setInterval(() => {
        setLockoutTime((prev) => {
          if (prev <= 1) {
            setIsLocked(false);
            setError(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }

    const checkRecaptcha = setInterval(() => {
    if (window.grecaptcha) {
      setRecaptchaLoaded(true);
      clearInterval(checkRecaptcha);
    }
    }, 100);
    return () => clearInterval(checkRecaptcha);
  }, [lockoutTime]);

  // Format lockout time display
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setWarning(null);
    setSuggestion(null);

    // Client-side validation
    if (!email.trim()) {
      setError("Please enter your email address");
      setIsLoading(false);
      return;
    }

    if (!email.includes("@") || !email.includes(".")) {
      setError("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    if (!password) {
      setError("Please enter your password");
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setIsLoading(false);
      return;
    }

    // reCAPTCHA check
    if (!window.grecaptcha) {
      setError("Security verification not loaded. Please refresh the page and try again.");
      setIsLoading(false);
      return;
    }

    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey) {
      setError("Security configuration error. Please contact support.");
      setIsLoading(false);
      return;
    }

    let recaptchaToken;
    try {
      recaptchaToken = await new Promise<string>((resolve, reject) => {
        window.grecaptcha.ready(() => {
          Promise.resolve(window.grecaptcha.execute(siteKey, { action: "login" }))
            .then(resolve)
            .catch(reject);
        });
      });

      if (!recaptchaToken) {
        setError("Security verification failed. Please try again.");
        setIsLoading(false);
        return;
      }
    } catch (err) {
      console.error("reCAPTCHA error:", err);
      setError("Security verification error. Please refresh the page and try again.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe, recaptchaToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle different error scenarios
        if (data.locked) {
          setIsLocked(true);
          setLockoutTime(data.remainingTime || 0);
        }

        if (data.warning) {
          setWarning(data.warning);
        }

        if (data.suggestion) {
          setSuggestion(data.suggestion);
        }

        throw new Error(data.error || "Login failed");
      }

      // Success - redirect
      router.push(data.redirectTo || "/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`}
        strategy="lazyOnload"
      />
      <div className="relative flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
        {/* Background */}
        <div className="fixed inset-0 h-screen w-screen bg-green-600 sm:[clip-path:polygon(0_0,70%_0,100%_100%,0%_100%)]" />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-12 p-8 md:grid-cols-2">
          {/* LEFT */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col justify-center text-white md:pr-8"
          >
            <h1 className="mt-12 font-serif text-4xl font-bold md:text-5xl">
              Welcome Back to EaziWage
            </h1>
            <p className="mt-4 text-lg text-green-100">
              Access your earned wages instantly, or manage your team.
            </p>
          </motion.div>

          {/* RIGHT */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-5 rounded-2xl bg-white p-8 shadow-lg"
          >
            <h2 className="text-2xl font-bold text-gray-900">Log In</h2>

            <form className="mt-6 space-y-4" onSubmit={handleLogin}>
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Work Email
                </label>
                <input
                  type="email"
                  required
                  className="mt-1 w-full rounded-lg border border-green-400 px-4 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLocked}
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="mt-1 w-full rounded-lg border border-green-400 px-4 py-2 pr-16 focus:ring-2 focus:ring-green-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLocked}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-9 text-sm text-gray-500 hover:text-gray-700 disabled:text-gray-400"
                  disabled={isLocked}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:cursor-not-allowed"
                    disabled={isLocked}
                  />
                  <span className={isLocked ? "text-gray-400" : ""}>
                    Remember me on this device
                  </span>
                </label>

                <a
                  href="/forgot-password"
                  className="text-sm font-medium text-green-600 hover:underline"
                >
                  Forgot password?
                </a>
              </div>

              {/* Lockout Timer */}
              {isLocked && lockoutTime > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-600 font-medium">
                    🔒 Account temporarily locked
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    Retry in: <span className="font-mono font-bold">{formatTime(lockoutTime)}</span>
                  </p>
                </div>
              )}

              {/* Warning */}
              {warning && !isLocked && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                  <p className="text-sm text-yellow-800">⚠️ {warning}</p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-600">{error}</p>
                  {suggestion && (
                    <p className="text-sm text-red-600 mt-2">
                      💡 {suggestion}
                    </p>
                  )}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className="mt-6 w-full rounded-lg bg-green-600 px-4 py-2 font-semibold text-white transition hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={isLoading || isLocked}
              >
                {isLoading
                  ? "Logging in..."
                  : isLocked
                  ? "Account Locked"
                  : "Log In"
                }
              </button>
            </form>

            {/* Remember me warning */}
            {rememberMe && (
              <p className="mt-4 text-xs text-gray-500 text-center">
                ℹ️ Only use "Remember me" on your personal device
              </p>
            )}

            <p className="mt-6 text-center text-sm text-gray-500">
              Don&apos;t have an account?{" "}
              <a
                href="/register"
                className="font-semibold text-green-600 hover:underline"
              >
                Sign up
              </a>
            </p>

            {/* reCAPTCHA badge info */}
            <p className="mt-4 text-xs text-gray-400 text-center">
              Protected by reCAPTCHA
            </p>
          </motion.div>
        </div>
      </div>
    </>
  );
}