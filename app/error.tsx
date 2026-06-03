"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCcw, Home, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

function getFriendlyMessage(error: Error): string {
  const msg = error.message?.toLowerCase() ?? "";
  
  // Handle common status codes or messages that might be embedded
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

  // Generic fallback that sounds professional but doesn't expose internals
  return "An unexpected error occurred while processing your request. We've logged the details and are looking into it.";
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service if available
    // For now, we'll just log to console with more context
    console.group("Application Error");
    console.error("Message:", error.message);
    console.error("Digest:", error.digest);
    console.error("Stack:", error.stack);
    console.groupEnd();
  }, [error]);

  const friendlyMessage = getFriendlyMessage(error);

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-8 relative">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-in fade-in zoom-in duration-500">
          <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
        </div>
        <div className="absolute -inset-4 bg-red-500/10 rounded-full blur-2xl -z-10 animate-pulse" />
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl mb-4">
        Oops! Something went wrong
      </h1>
      
      <div className="max-w-md mx-auto mb-10 space-y-4">
        <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
          {friendlyMessage}
        </p>
        
        {error.digest && (
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded-md inline-block">
            Error ID: {error.digest}
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-sm mx-auto">
        <Button 
          onClick={reset}
          size="lg"
          className="w-full bg-primary text-white hover:bg-primary/90 rounded-xl h-12 shadow-lg shadow-primary/20 transition-all active:scale-95"
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          Try again
        </Button>
        
        <Link href="/" className="w-full">
          <Button 
            variant="outline"
            size="lg"
            className="w-full border-slate-200 dark:border-slate-800 rounded-xl h-12 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all active:scale-95"
          >
            <Home className="w-4 h-4 mr-2" />
            Return Home
          </Button>
        </Link>
      </div>

      <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 w-full max-w-md">
        <p className="text-sm text-slate-500 dark:text-slate-500 mb-4">
          Need immediate assistance?
        </p>
        <div className="flex justify-center gap-6">
          <Link href="/contact" className="text-primary hover:underline text-sm font-medium">
            Contact Support
          </Link>
          <Link href="/dashboards/employee-dashboard/support" className="text-primary hover:underline text-sm font-medium">
            Help Center
          </Link>
        </div>
      </div>
    </div>
  );
}
