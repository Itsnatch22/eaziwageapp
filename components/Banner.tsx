"use client";

import { useState } from "react";
import {
  X,
  Megaphone,
  Info,
  AlertTriangle,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type BannerVariant = "announcement" | "info" | "success" | "warning" | "error";

interface BannerProps {
  variant?: BannerVariant;
  title?: string;
  message: React.ReactNode;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const VARIANT_STYLES: Record<BannerVariant, string> = {
  announcement:
    "bg-primary/10 border-primary/20 text-primary dark:bg-primary/15 dark:border-primary/30",
  info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-300",
  success:
    "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300",
  warning:
    "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300",
  error:
    "bg-red-50 border-red-200 text-red-800 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300",
};

const VARIANT_ICONS: Record<BannerVariant, LucideIcon> = {
  announcement: Megaphone,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
};

// Not wired into the root layout — each consumer mounts it on its own page
// (e.g. app/dashboards/employee-dashboard/payment-methods/page.tsx) and
// decides whether/how to persist the dismissed state.
export function Banner({
  variant = "announcement",
  title,
  message,
  actionLabel,
  actionHref,
  onAction,
  dismissible = true,
  onDismiss,
  className,
}: BannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const Icon = VARIANT_ICONS[variant];

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      role="status"
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 border text-sm",
        VARIANT_STYLES[variant],
        className,
      )}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />

      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cn("opacity-90", title && "mt-0.5")}>{message}</div>

        {actionLabel && (actionHref || onAction) && (
          actionHref ? (
            <a
              href={actionHref}
              className="inline-block mt-2 font-medium underline underline-offset-2 hover:opacity-80"
            >
              {actionLabel}
            </a>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-block mt-2 font-medium underline underline-offset-2 hover:opacity-80"
            >
              {actionLabel}
            </button>
          )
        )}
      </div>

      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss announcement"
          className="shrink-0 rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
