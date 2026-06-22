"use client";

import { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocTooltipProps {
  content: string;
  className?: string;
}

export function DocTooltip({ content, className }: DocTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-flex items-center", className)}>
      <button
        type="button"
        aria-label="Why is this required?"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-slate-400 hover:text-primary transition-colors focus:outline-none"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          role="tooltip"
          className={cn(
            "absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2",
            "w-56 rounded-xl bg-slate-900 dark:bg-slate-700 px-3 py-2.5 shadow-xl",
            "text-xs text-white leading-relaxed",

            "after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2",
            "after:border-4 after:border-transparent after:border-t-slate-900 dark:after:border-t-slate-700"
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}