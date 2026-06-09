"use client";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const { isOnline, isChecking } = useNetworkStatus();
  const [showOnline, setShowOnline] = useState(false);

  useEffect(() => {
    if (!isOnline || isChecking) return

    const showTimer = window.setTimeout(() => {
      setShowOnline(true)
    }, 0)

    const hideTimer = window.setTimeout(() => {
      setShowOnline(false)
    }, 4000)

    return () => {
      window.clearTimeout(showTimer)
      window.clearTimeout(hideTimer)
    }
  }, [isOnline, isChecking])

  if (isOnline && !isChecking && !showOnline) return null

  return (
    <div
      className={`
        w-full px-4 py-2.5 flex items-center gap-3 text-sm font-medium
        transition-all duration-300
        ${isChecking
          ? "bg-amber-50 border border-amber-200 text-amber-800"
          : isOnline
          ? "bg-green-50 border border-green-200 text-green-800"
          : "bg-red-50 border border-red-200 text-red-800"}
      `}
    >
      <span className={`w-2 h-2 rounded-full shrink-0
        ${isChecking ? "bg-amber-500 animate-pulse" : isOnline ? "bg-green-500" : "bg-red-500 animate-pulse"}
      `} />

      <div className="flex-1">
        {isChecking
          ? "Checking connection…"
          : isOnline
          ? "You're back online"
          : "You're offline"}
        <p className="text-xs font-normal opacity-75 mt-0.5">
          {isChecking
            ? "Hold on while we verify your network"
            : isOnline
            ? "Everything is synced"
            : "Your progress is saved — don't close this tab"}
        </p>
      </div>

      {isChecking
        ? <RefreshCw size={15} className="opacity-60" />
        : isOnline
        ? <Wifi size={15} className="opacity-60" />
        : <WifiOff size={15} className="opacity-60" />}
    </div>
  );
}