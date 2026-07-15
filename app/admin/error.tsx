"use client";

import { useEffect, useState } from "react";
import { RefreshCcw, LayoutDashboard, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

function getFriendlyMessage(error: Error): string {
  const msg = error.message?.toLowerCase() ?? "";

  if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("login"))
    return "Your session has expired or you are not logged in. Please sign in to continue.";

  if (msg.includes("403") || msg.includes("forbidden") || msg.includes("permission"))
    return "You don't have the necessary permissions to view this content. If you believe this is an error, please contact your administrator.";

  if (msg.includes("404") || msg.includes("not found"))
    return "The resource you are looking for could not be found. It might have been moved or deleted.";

  if (msg.includes("429") || msg.includes("too many requests") || msg.includes("rate limit"))
    return "You've made too many requests in a short time. Please take a short break and try again in a few minutes.";

  if (msg.includes("500") || msg.includes("internal server error") || msg.includes("database") || msg.includes("supabase"))
    return "We're experiencing some technical difficulties on our end. Our engineering team has been notified.";

  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch") || msg.includes("offline"))
    return "It looks like there's a problem with your internet connection. Please check your network and try again.";

  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("deadline"))
    return "The request took longer than expected to complete. The server might be under heavy load.";

  return "An unexpected error occurred while processing your request. We've logged the details and are looking into it.";
}

export default function AdminError({ error, reset }: ErrorProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    console.group("Application Error [admin]");
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
        role: "admin",
        userId: null,
      }),
    }).catch(() => {});
  }, [error]);

  const friendlyMessage = getFriendlyMessage(error);

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
        Something didn&apos;t go as planned
      </h1>

      <div className="max-w-md mx-auto mb-6 space-y-4">
        <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed">
          {friendlyMessage}
        </p>

        {error.digest && (
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40 px-3 py-1.5 rounded-full inline-block">
            Error ID: {error.digest}
          </span>
        )}
      </div>

      {/* Admin-specific guidance */}
      <div className="max-w-md mx-auto mb-8 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/30 p-5 text-left space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
          Admin actions
        </p>
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <li>• Check system audit logs for recent changes</li>
          <li>• Review the Supabase dashboard for DB errors</li>
        </ul>
        <div className="pt-3 flex flex-col gap-1.5">
          <Link href="/admin/logs" className="text-primary hover:underline text-sm font-medium">
            → View error logs
          </Link>
          <Link href="/admin" className="text-primary hover:underline text-sm font-medium">
            → Admin Dashboard
          </Link>
        </div>
      </div>

      {/* Collapsible raw error details */}
      <div className="max-w-md mx-auto mb-8 w-full">
        <button
          onClick={() => setDetailsOpen((v) => !v)}
          className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors mx-auto"
        >
          {detailsOpen ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
          {detailsOpen ? "Hide" : "Show"} error details
        </button>

        {detailsOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.25 }}
            className="mt-3 overflow-hidden"
          >
            <pre className="text-left text-xs font-mono bg-slate-900 dark:bg-slate-950 text-slate-300 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all border border-slate-700/60">
              <span className="text-slate-500">message: </span>
              {error.message}
              {"\n\n"}
              <span className="text-slate-500">stack:</span>
              {"\n"}
              {error.stack ?? "—"}
            </pre>
          </motion.div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-sm mx-auto">
        <div className="w-full">
          <Button
            onClick={reset}
            size="lg"
            className="w-full rounded-xl h-11 shadow-sm transition-all active:scale-95"
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Try again
          </Button>
        </div>

        <Link href="/admin" className="w-full">
          <Button
            variant="outline"
            size="lg"
            className="w-full border-slate-200 dark:border-slate-700 rounded-xl h-11 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all active:scale-95"
          >
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Admin Dashboard
          </Button>
        </Link>
      </div>

      <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 w-full max-w-md">
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
          Need immediate assistance?
        </p>
        <div className="flex justify-center gap-6">
          <Link href="/contact" className="text-primary hover:underline text-sm font-medium">
            Contact Support
          </Link>
          <Link
            href="/contact"
            className="text-primary hover:underline text-sm font-medium"
          >
            Help Center
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
