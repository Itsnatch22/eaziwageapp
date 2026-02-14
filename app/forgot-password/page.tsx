"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const validateEmail = (value: string) =>
    /^\S+@\S+\.\S+$/.test(value.trim());

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateEmail(email)) {
      setError("Please enter a valid work email");
      return;
    }

    setIsLoading(true);
    try {
      // Provide a redirect URL so the reset link lands back in the app.
      const redirectTo = `${window.location.origin}/reset`;

      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), redirectTo }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Expect the API to return { error: "..." } on failure
        throw new Error(data?.error || "Failed to send reset email");
      }

      // UX: don't reveal whether the email exists — generic message
      setSuccess(
        "If an account exists for that email, we sent a password reset link. Check your inbox."
      );

      // Optionally redirect to login after a short pause
      setTimeout(() => {
        router.push("/");
      }, 4500);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
      <div className="absolute inset-0 bg-green-600 [clip-path:polygon(0_0,100%_0,100%_100%,0%_100%)] sm:[clip-path:polygon(0_0,70%_0,100%_100%,0%_100%)]" />

      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-8 shadow-lg"
      >
        <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
        <p className="mt-2 text-sm text-gray-600">
          Enter the email associated with your EaziWage account and we&apos;ll send a
          secure link to reset your password.
        </p>

        <form className="mt-6" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700">
            Work Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="mt-2 w-full rounded-lg border border-green-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              aria-label="Work email"
            />
          </label>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {success && <p className="mt-3 text-sm text-green-700">{success}</p>}

          <div className="mt-6 flex items-center justify-between">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
            >
              {isLoading ? "Sending..." : "Send reset link"}
            </button>

            <a
              className="text-sm text-gray-600 hover:underline"
              href="/"
            >
              Back to login
            </a>
          </div>
        </form>

        <div className="mt-6 text-xs text-gray-400">
          Tip: If you don't see the email, check your spam folder or contact
          support at <span className="font-mono">support@eaziwage.com</span>.
        </div>
      </motion.main>
    </div>
  );
}
