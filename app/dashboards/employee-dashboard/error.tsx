"use client";

import { useEffect } from "react";
import { RefreshCcw, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function EmployeeError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.group("Application Error [employee-dashboard]");
    console.error("Message:", error.message);
    console.error("Digest:", error.digest);
    console.error("Stack:", error.stack);
    console.groupEnd();

    fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest ?? null,
        stack: error.stack ?? null,
        url: window.location.pathname,
        role: "employee",
        userId: null,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex min-h-[80vh] flex-col items-center justify-center px-6 py-12 text-center"
    >
      <div className="mb-8 relative flex items-center justify-center">
        <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center">
          <svg
            className="w-9 h-9 text-slate-400 dark:text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
        </div>
        <div className="absolute inset-0 rounded-2xl bg-emerald-500/5 blur-2xl -z-10" />
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl mb-3">
        That didn&apos;t quite work
      </h1>

      <div className="max-w-md mx-auto mb-6">
        <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed">
          Don&apos;t worry — this happens sometimes. Your account is fine and nothing has been lost.
        </p>
      </div>

      {/* Employee-specific reassurance — no technical details */}
      <div className="max-w-md mx-auto mb-8 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/30 p-5 text-left space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
          Here&apos;s what you should know
        </p>
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <li>• Your advance request has not been submitted if you were in the middle of one</li>
          <li>• Your salary and advance history are safe</li>
        </ul>
        <div className="pt-3 flex flex-col gap-1.5">
          <Link
            href="/dashboards/employee-dashboard"
            className="text-primary hover:underline text-sm font-medium"
          >
            → Go back to your dashboard
          </Link>
          <Link
            href="/dashboards/employee-dashboard/support"
            className="text-primary hover:underline text-sm font-medium"
          >
            → Get help from support
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-sm mx-auto">
        <Button
          onClick={reset}
          size="lg"
          className="w-full rounded-xl h-11 shadow-sm transition-all active:scale-95"
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          Try again
        </Button>

        <Link href="/dashboards/employee-dashboard" className="w-full">
          <Button
            variant="outline"
            size="lg"
            className="w-full border-slate-200 dark:border-slate-700 rounded-xl h-11 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all active:scale-95"
          >
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Go to Dashboard
          </Button>
        </Link>
      </div>

      <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 w-full max-w-md">
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
          Still having trouble?
        </p>
        <div className="flex justify-center gap-6">
          <Link href="/contact" className="text-primary hover:underline text-sm font-medium">
            Contact Support
          </Link>
          <Link
            href="/dashboards/employee-dashboard/support"
            className="text-primary hover:underline text-sm font-medium"
          >
            Help Center
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
