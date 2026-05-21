"use client";

import { useEffect } from "react";

function getFriendlyMessage(error: Error): string {
  const msg = error.message?.toLowerCase() ?? "";

  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch"))
    return "Looks like you're offline. Check your connection and try again.";
  if (msg.includes("unauthorized") || msg.includes("401"))
    return "Your session expired. Please sign in again.";
  if (msg.includes("forbidden") || msg.includes("403"))
    return "You don't have permission to access this.";
  if (msg.includes("not found") || msg.includes("404"))
    return "We couldn't find what you were looking for.";
  if (msg.includes("timeout") || msg.includes("timed out"))
    return "The request took too long. Please try again.";
  if (msg.includes("500") || msg.includes("server"))
    return "Our servers are having a moment. We're on it.";
  if (msg.includes("rate limit") || msg.includes("429"))
    return "Too many requests. Give it a moment and try again.";

  return "Something unexpected happened. It's not you, it's us.";
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center">
        <h2 className="mb-4 text-2xl font-bold">Something went wrong!</h2>
        <p className="text-muted-foreground mb-6">
          {getFriendlyMessage(error)}
        </p>
        <button
          onClick={reset}
          className="bg-green-300 text-primary-foreground hover:bg-green-400/90 rounded-md px-4 py-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}