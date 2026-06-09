"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Info,
  ChevronDown,
  Clock,
  Smartphone,
  CheckCircle2,
  Zap,
  ArrowRight,
  Shield,
  Loader2,
  Landmark,
  Wallet,
  TrendingUp,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  calculateFeePercentage,
  cn,
  getCurrencySymbol,
} from "@/lib/utils";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/useCurrency";
import { EmployeePortalLayout } from "@/components/employee/EmployeeLayout";
import { Label } from "@/components/ui/label";

interface EmployeeProfile {
  id?: string;
  status?: string;
  kyc_status?: string;
  advance_limit?: number;
  earned_wages?: number;
  risk_score?: number;
  currency?: string;
  mobile_money_provider?: string;
  mobile_money_number?: string;
  bank_name?: string;
  bank_account?: string;
  full_name?: string;
}

type DisbursementMethod = "mobile_money" | "bank_transfer";

const XIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const MetricCard = ({
  icon: Icon,
  label,
  value,
  subtext,
  accent = "#10b981",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  subtext?: string;
  accent?: string;
}) => (
  <div className="relative bg-white/50 dark:bg-white/4 backdrop-blur-xl rounded-2xl p-5 border border-white/60 dark:border-white/10 overflow-hidden group transition-all duration-300 hover:border-white/80 dark:hover:border-white/20">
    {/* Subtle ambient glow */}
    <div
      className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity"
      style={{ background: accent }}
    />

    <div className="relative z-10">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
        style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
      >
        <Icon className="w-4 h-4" style={{ color: accent }} />
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums">
        {value}
      </p>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-1">
        {label}
      </p>
      {subtext && (
        <p className="text-[10px] text-slate-400/60 mt-0.5">{subtext}</p>
      )}
    </div>
  </div>
);

const CircularAmountSelector = ({
  value,
  max,
  currency = "KES",
}: {
  value: number;
  max: number;
  currency?: string;
}) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="relative w-56 h-56 mx-auto">
      {/* Ambient */}
      <div
        className="absolute inset-4 rounded-full blur-2xl opacity-10"
        style={{ background: "radial-gradient(circle, #10b981, transparent)" }}
      />

      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-slate-100 dark:text-white/5"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0df259" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400 mb-1">
          Requesting
        </p>
        <p className="text-4xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
          {formatCurrency(value, currency).split(".")[0]}
        </p>
        <div
          className="mt-2 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
          style={{ background: "#10b98115", border: "1px solid #10b98125" }}
        >
          {pct.toFixed(0)}% of limit
        </div>
      </div>
    </div>
  );
};

export default function RequestAdvance() {
  const { currency } = useCurrency();
  const router = useRouter();
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [amount, setAmount] = useState(0);
  const [disbursementMethod, setDisbursementMethod] =
    useState<DisbursementMethod>("mobile_money");

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch("/api/employee-dashboard/overview");
        const data = await res.json();
        if (!res.ok) {
          toast.error("Failed to load portal data");
          return;
        }
        if (cancelled) return;

        const profile = { ...(data?.employee || {}), ...(data?.stats || {}) };
        setEmployee(profile);

        const available = Math.min(
          profile.advance_limit || 0,
          profile.earned_wages || 0,
        );
        if (available > 0) {
          setAmount(Math.min(500, available));
        }
      } catch {
        if (!cancelled) toast.error("Connection error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  const maxAmount = Math.min(
    employee?.advance_limit || 0,
    employee?.earned_wages || 0,
  );

  const feePercentage = calculateFeePercentage(employee?.risk_score || 3.0);
  const feeAmount = amount * (feePercentage / 100);
  const netAmount = amount - feeAmount;
  const quickAmounts = [1000, 2000, 5000, 10000];

  const handleSubmit = async () => {
    if (amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/employee-dashboard/request-advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          disbursement_method: disbursementMethod,
        }),
      });
      if (res.ok) {
        toast.success("Funds requested successfully!");
        router.push("/dashboards/employee-dashboard/transactions");
      } else {
        const d = await res.json();
        toast.error(d.message || "Request failed");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const isVerified =
    employee?.status === "approved" || employee?.status === "active";
  const isPending =
    employee?.kyc_status === "submitted" || employee?.kyc_status === "pending";

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading)
    return (
      <EmployeePortalLayout title="Withdrawal">
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Verifying limit…
          </p>
        </div>
      </EmployeePortalLayout>
    );

  // ── KYC Gate ────────────────────────────────────────────────────────────────
  if (!isVerified)
    return (
      <EmployeePortalLayout title="Access Restricted">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <MetricCard
              icon={Shield}
              label="Account Status"
              value={isPending ? "Pending" : "Incomplete"}
              accent="#f59e0b"
            />
            <MetricCard
              icon={Wallet}
              label="Advance Limit"
              value={formatCurrency(0, currency)}
              accent="#3b82f6"
            />
            <MetricCard
              icon={Clock}
              label="Review Time"
              value="24–48h"
              subtext="Estimated duration"
              accent="#8b5cf6"
            />
          </div>

          <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 p-10 text-center space-y-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: "#f59e0b12", border: "1px solid #f59e0b25" }}
            >
              {isPending ? (
                <Clock className="w-8 h-8 text-amber-500 animate-pulse" />
              ) : (
                <AlertCircle className="w-8 h-8 text-amber-500" />
              )}
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {isPending
                  ? "Application Under Review"
                  : "KYC Verification Required"}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {isPending
                  ? "We've received your documents and our compliance team is reviewing them. You'll be notified once your account is active."
                  : "To unlock wage advances, we need to verify your identity. Secure and takes just a few minutes."}
              </p>
            </div>

            {!isPending ? (
              <Button
                onClick={() =>
                  router.push("/dashboards/employee-dashboard/onboarding")
                }
                className="h-12 px-8 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
              >
                Complete Onboarding <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <span className="inline-block px-4 py-1.5 bg-slate-100 dark:bg-white/5 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-white/10">
                Documents Submitted
              </span>
            )}
          </div>
        </div>
      </EmployeePortalLayout>
    );

  // ── Active Flow ─────────────────────────────────────────────────────────────
  return (
    <EmployeePortalLayout title="Wage Advance">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            icon={TrendingUp}
            label="Available Wages"
            value={formatCurrency(employee?.earned_wages || 0, currency)}
            subtext="Accrued this month"
            accent="#3b82f6"
          />
          <MetricCard
            icon={Shield}
            label="Maximum Limit"
            value={formatCurrency(employee?.advance_limit || 0, currency)}
            subtext="Based on risk score"
            accent="#10b981"
          />
          <MetricCard
            icon={Wallet}
            label="Net Disbursement"
            value={formatCurrency(netAmount, currency)}
            subtext={`After ${feePercentage}% fee`}
            accent="#10b981"
          />
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Amount Selector */}
          <div className="lg:col-span-3">
            <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 p-8 space-y-8">
              <CircularAmountSelector
                value={amount}
                max={maxAmount}
                currency={currency}
              />

              <div className="space-y-5">
                {/* Slider */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Adjust amount
                    </Label>
                    <span className="text-sm font-bold text-emerald-500">
                      {formatCurrency(amount, currency)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={maxAmount}
                    step="100"
                    value={amount}
                    onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-emerald-500"
                    style={{
                      background: `linear-gradient(to right, #10b981 ${(amount / (maxAmount || 1)) * 100}%, #e2e8f0 ${(amount / (maxAmount || 1)) * 100}%)`,
                    }}
                  />
                  <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>0</span>
                    <span>{formatCurrency(maxAmount, currency)}</span>
                  </div>
                </div>

                {/* Quick Amounts */}
                <div className="grid grid-cols-4 gap-2">
                  {[...quickAmounts.filter((a) => a < maxAmount), maxAmount]
                    .slice(-4)
                    .map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setAmount(amt)}
                        className={cn(
                          "py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border",
                          amount === amt
                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent"
                            : "bg-white/60 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:border-emerald-400/50",
                        )}
                      >
                        {amt === maxAmount
                          ? "Max"
                          : formatCurrency(amt, currency)
                              .split(".")[0]
                              .replace(getCurrencySymbol(currency), "")
                              .trim()}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Summary */}
            <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 p-6 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Info className="w-3.5 h-3.5" /> Payout Summary
              </p>

              <div className="space-y-2">
                {[
                  {
                    label: "Requested",
                    value: formatCurrency(amount, currency),
                    color: "text-slate-900 dark:text-white",
                  },
                  {
                    label: `Fee (${feePercentage}%)`,
                    value: `−${formatCurrency(feeAmount, currency)}`,
                    color: "text-red-500",
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between items-center py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-white/3 border border-slate-100 dark:border-white/5"
                  >
                    <span className="text-xs text-slate-400 font-semibold">
                      {row.label}
                    </span>
                    <span
                      className={cn(
                        "font-bold text-sm tabular-nums",
                        row.color,
                      )}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Total Payout
                </span>
                <span className="text-3xl font-bold text-emerald-500 tabular-nums tracking-tight">
                  {formatCurrency(netAmount, currency).split(".")[0]}
                </span>
              </div>
            </div>

            {/* Disbursement Method */}
            <div className="relative bg-slate-900 dark:bg-white/4 backdrop-blur-xl rounded-3xl border border-white/10 p-6 overflow-hidden">
              {/* Background icon */}
              <div className="absolute bottom-4 right-4 opacity-[0.06]">
                {disbursementMethod === "mobile_money" ? (
                  <Smartphone className="w-24 h-24 text-white" />
                ) : (
                  <Landmark className="w-24 h-24 text-white" />
                )}
              </div>

              <div className="relative z-10 space-y-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">
                  Disbursement Method
                </p>
                <div>
                  <p className="text-base font-bold text-white tracking-tight">
                    {disbursementMethod === "mobile_money"
                      ? employee?.mobile_money_provider || "Mobile Money"
                      : employee?.bank_name || "Bank Transfer"}
                  </p>
                  <p className="text-xs font-semibold text-emerald-400 mt-0.5">
                    {disbursementMethod === "mobile_money"
                      ? employee?.mobile_money_number || "••••••••"
                      : employee?.bank_account
                        ? `•••• ${employee.bank_account.slice(-4)}`
                        : "••••••••"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMethodSelector(!showMethodSelector)}
                  className="w-full bg-white/10 border-white/15 text-white/80 hover:bg-white/15 hover:text-white rounded-xl text-xs font-semibold"
                >
                  Change <ChevronDown className="ml-1.5 w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Method Selector Overlay */}
              {showMethodSelector && (
                <div className="absolute inset-0 bg-white dark:bg-slate-900 z-50 rounded-3xl p-5 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Select Method
                    </p>
                    <button
                      onClick={() => setShowMethodSelector(false)}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {[
                      {
                        id: "mobile_money",
                        label:
                          employee?.mobile_money_provider || "Mobile Money",
                        sub: employee?.mobile_money_number || "••••••••",
                        icon: Smartphone,
                      },
                      {
                        id: "bank_transfer",
                        label: employee?.bank_name || "Bank Account",
                        sub: employee?.bank_account
                          ? `••••${employee.bank_account.slice(-4)}`
                          : "••••••••",
                        icon: Landmark,
                      },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setDisbursementMethod(m.id as DisbursementMethod);
                          setShowMethodSelector(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                          disbursementMethod === m.id
                            ? "border-emerald-400/40 bg-emerald-50 dark:bg-emerald-500/5"
                            : "border-slate-100 dark:border-white/10 hover:border-slate-200 dark:hover:border-white/20",
                        )}
                      >
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-white/5">
                          <m.icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {m.label}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                            {m.sub}
                          </p>
                        </div>
                        {disbursementMethod === m.id && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* CTA */}
            <Button
              onClick={handleSubmit}
              disabled={submitting || amount <= 0 || amount > maxAmount}
              className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4 fill-current" /> Request Advance
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </EmployeePortalLayout>
  );
}