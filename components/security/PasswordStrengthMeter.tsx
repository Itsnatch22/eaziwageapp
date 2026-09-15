"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordStrengthResult {
  score: number;
  label: string;
  percent: number;
  colorClass: string;
  requirements: Array<{ label: string; met: boolean }>;
}

export function getPasswordStrength(password: string): PasswordStrengthResult {
  const requirements = [
    { label: "8+ characters", met: password.length >= 8 },
    { label: "Upper and lower case", met: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: "Number", met: /\d/.test(password) },
    { label: "Symbol", met: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = requirements.filter((item) => item.met).length;

  if (!password) {
    return { score: 0, label: "Not started", percent: 0, colorClass: "bg-slate-200 dark:bg-slate-700", requirements };
  }

  if (score <= 1) {
    return { score, label: "Weak", percent: 25, colorClass: "bg-red-500", requirements };
  }

  if (score === 2) {
    return { score, label: "Fair", percent: 50, colorClass: "bg-amber-500", requirements };
  }

  if (score === 3) {
    return { score, label: "Good", percent: 75, colorClass: "bg-blue-500", requirements };
  }

  return { score, label: "Strong", percent: 100, colorClass: "bg-emerald-500", requirements };
}

export function isPasswordAcceptable(password: string) {
  return getPasswordStrength(password).score >= 3;
}

export function PasswordStrengthMeter({
  password,
  className,
}: {
  password: string;
  className?: string;
}) {
  const strength = getPasswordStrength(password);

  if (!password) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={cn("h-full rounded-full transition-all duration-300", strength.colorClass)}
            style={{ width: `${strength.percent}%` }}
          />
        </div>
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{strength.label}</span>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {strength.requirements.map((item) => (
          <div
            key={item.label}
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-medium",
              item.met ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
            )}
          >
            {item.met ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
