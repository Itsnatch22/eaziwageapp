"use client";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { Loader2, WifiOff } from "lucide-react";
import React from "react";

interface SubmitButtonProps {
  isLoading?: boolean;
  label?: React.ReactNode;
  loadingLabel?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit" | "reset";
}

export function SubmitButton({
  isLoading = false,
  label = "Submit",
  loadingLabel = "Submitting...",
  onClick,
  className,
  type = "submit",
}: SubmitButtonProps) {
  const { isOnline, isChecking } = useNetworkStatus();

  const disabled = isLoading || !isOnline || isChecking;

  const getTooltip = () => {
    if (!isOnline) return "You're offline — reconnect to continue";
    if (isChecking) return "Checking connection...";
    return undefined;
  };

  return (
    <div className="relative" title={getTooltip()}>
      <button
        type={type}
        disabled={disabled}
        onClick={onClick}
        className={`
          w-full flex items-center justify-center gap-2
          px-4 py-2.5 rounded-lg text-sm font-medium
          transition-all duration-200
          ${disabled
            ? "opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 border border-gray-200"
            : "bg-primary text-white hover:bg-primary/90 active:scale-[0.98]"}
          ${className ?? ""}
        `}
      >
        {isLoading ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            {loadingLabel}
          </>
        ) : !isOnline ? (
          <>
            <WifiOff size={15} />
            Offline
          </>
        ) : (
          label
        )}
      </button>
    </div>
  );
}