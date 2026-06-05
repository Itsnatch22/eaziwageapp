"use client";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { Loader2, WifiOff } from "lucide-react";

interface SubmitButtonProps {
  isLoading?: boolean;
  label?: string;
  loadingLabel?: string;
  onClick?: () => void;
  className?: string;
}

export function SubmitButton({
  isLoading = false,
  label = "Submit",
  loadingLabel = "Submitting...",
  onClick,
  className,
}: SubmitButtonProps) {
  const { isOnline, isChecking } = useNetworkStatus();

  const disabled = isLoading || !isOnline || isChecking;

  const getTooltip = () => {
    if (!isOnline) return "You're offline — reconnect to continue";
    if (isChecking) return "Checking connection...";
    return undefined;
  };

  return (
    <div className="relative w-full" title={getTooltip()}>
      <button
        type="button"
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