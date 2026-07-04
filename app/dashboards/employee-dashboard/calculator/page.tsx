'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calculator, ArrowLeft, ArrowRight, TrendingUp, Calendar,
  AlertCircle, CheckCircle2, Clock, Loader2, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EmployeePortalLayout } from '@/components/employee/EmployeeLayout';
import { toast } from 'sonner';

// ── Currency formatting ──────────────────────────────────────────────────────

const CURRENCY_CONFIG = {
  KES: { locale: 'en-KE', symbol: 'KES', decimals: 0 },
  UGX: { locale: 'en-UG', symbol: 'UGX', decimals: 0 },
  TZS: { locale: 'en-TZ', symbol: 'TZS', decimals: 0 },
  RWF: { locale: 'en-RW', symbol: 'RWF', decimals: 0 },
} as const;

function fmt(amount: number, currency: string): string {
  const config = CURRENCY_CONFIG[currency as keyof typeof CURRENCY_CONFIG]
    ?? { locale: 'en-KE', symbol: currency, decimals: 0 };
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: config.decimals,
  }).format(amount);
}

// ── Next payday calculation ──────────────────────────────────────────────────

function getNextPayday(cycle: string): string {
  const now = new Date();
  let payday: Date;
  switch (cycle?.toLowerCase()) {
    case 'weekly':
      payday = new Date(now);
      payday.setDate(now.getDate() + (7 - now.getDay() || 7));
      break;
    case 'bi-weekly':
    case 'biweekly':
      payday = new Date(now);
      payday.setDate(now.getDate() + 14);
      break;
    case 'semi-monthly':
      payday = new Date(now.getFullYear(), now.getMonth(), now.getDate() < 15 ? 15 : 0);
      if (payday <= now) payday = new Date(now.getFullYear(), now.getMonth() + 1, 15);
      break;
    case 'monthly':
    default:
      payday = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
  }
  return payday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Limit colour ─────────────────────────────────────────────────────────────

function limitColor(remaining: number, max: number) {
  const pct = max > 0 ? (remaining / max) * 100 : 0;
  if (pct > 50) return { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' };
  if (pct > 20) return { bar: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' };
  return { bar: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' };
}

// ── Types ────────────────────────────────────────────────────────────────────

interface CalcData {
  monthly_salary: number;
  advance_limit_percent: number;
  min_advance_amount: number;
  max_advance_amount: number;
  processing_fee_pct: number;
  cooldown_days: number;
  max_monthly_advances: number;
  currency: string;
  payroll_cycle: string;
  advances_this_month: number;
  cooldown_days_remaining: number;
  current_limit: number;
  ewa_enabled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdvanceCalculatorPage() {
  const router = useRouter();
  const [data, setData]       = useState<CalcData | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount]   = useState(0);
  const [inputVal, setInputVal] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/employee-dashboard/calculator');
      if (!res.ok) throw new Error('Failed to load calculator data');
      const json = await res.json() as CalcData;
      setData(json);
      // Pre-fill slider at 50% of limit
      const initial = Math.floor((json.current_limit * 0.5) / 100) * 100;
      const clamped = Math.max(json.min_advance_amount, Math.min(initial, json.current_limit));
      setAmount(clamped);
      setInputVal(String(clamped));
    } catch {
      toast.error('Could not load your advance eligibility data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { Promise.resolve().then(() => fetchData()); }, [fetchData]);

  if (loading) return (
    <EmployeePortalLayout>
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading your data…</p>
      </div>
    </EmployeePortalLayout>
  );

  if (!data) return (
    <EmployeePortalLayout>
      <div className="max-w-lg mx-auto text-center py-20 space-y-4">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <p className="text-slate-600 dark:text-slate-400">Could not load your advance data. Make sure your profile is approved.</p>
        <Button variant="outline" onClick={() => router.back()}>Go back</Button>
      </div>
    </EmployeePortalLayout>
  );

  // ── Derived calculations ──
  const {
    monthly_salary, advance_limit_percent, min_advance_amount, max_advance_amount,
    processing_fee_pct, cooldown_days, max_monthly_advances, currency,
    payroll_cycle, advances_this_month, cooldown_days_remaining, current_limit, ewa_enabled,
  } = data;

  const maxAdvance = Math.min(
    (monthly_salary * advance_limit_percent) / 100,
    max_advance_amount,
    current_limit
  );

  const feeAmount  = (amount * processing_fee_pct) / 100;
  const netAmount  = amount - feeAmount;
  const remaining  = Math.max(0, maxAdvance - amount);
  const advancesLeft = Math.max(0, max_monthly_advances - advances_this_month);
  const nextPayday = getNextPayday(payroll_cycle);
  const colors     = limitColor(remaining, maxAdvance);

  // Validation
  const inCooldown        = cooldown_days_remaining > 0;
  const monthlyLimitHit   = advancesLeft <= 0;
  const belowMin          = amount > 0 && amount < min_advance_amount;
  const aboveMax          = amount > maxAdvance;
  const ewaDisabled       = !ewa_enabled;
  const canRequest        = !inCooldown && !monthlyLimitHit && !belowMin && !aboveMax && amount >= min_advance_amount && !ewaDisabled;

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setAmount(v);
    setInputVal(String(v));
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setInputVal(raw);
    const v = Number(raw);
    if (!isNaN(v)) setAmount(Math.min(v, maxAdvance));
  };

  const handleInputBlur = () => {
    const v = Math.max(min_advance_amount, Math.min(amount, maxAdvance));
    setAmount(v);
    setInputVal(String(v));
  };

  const handleRequest = () => {
    router.push(`/dashboards/employee-dashboard/request-advance?amount=${amount}`);
  };

  const limitPct = maxAdvance > 0 ? Math.min(100, (amount / maxAdvance) * 100) : 0;

  return (
    <EmployeePortalLayout>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="w-6 h-6 text-emerald-500" />
              Advance Calculator
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
              Preview fees and repayment before you request
            </p>
          </div>
        </div>

        {/* Eligibility blocks */}
        {ewaDisabled && (
          <div className="flex items-start gap-3 p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <AlertCircle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-600 dark:text-slate-400">EWA access is currently disabled for your account. Contact your employer for more information.</p>
          </div>
        )}

        {inCooldown && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800">
            <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Cooldown period active</p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                You can request your next advance in <strong>{cooldown_days_remaining} day{cooldown_days_remaining !== 1 ? 's' : ''}</strong>.
                Your employer requires a {cooldown_days}-day gap between advances.
              </p>
            </div>
          </div>
        )}

        {monthlyLimitHit && !inCooldown && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Monthly limit reached</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                You&apos;ve used all {max_monthly_advances} advance{max_monthly_advances !== 1 ? 's' : ''} for this month. Resets on the 1st.
              </p>
            </div>
          </div>
        )}

        {/* Amount input */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl border border-slate-200/50 dark:border-slate-700/30 p-6 space-y-6">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Advance Amount
            </label>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-500">{currency}</span>
              <input
                type="text"
                inputMode="numeric"
                value={inputVal}
                onChange={handleInput}
                onBlur={handleInputBlur}
                disabled={ewaDisabled || monthlyLimitHit || inCooldown}
                className={cn(
                  'flex-1 text-3xl font-bold bg-transparent outline-none text-slate-900 dark:text-white',
                  'disabled:opacity-40 disabled:cursor-not-allowed'
                )}
                placeholder="0"
              />
            </div>
          </div>

          {/* Slider */}
          <div className="space-y-2">
            <input
              type="range"
              min={min_advance_amount}
              max={maxAdvance > 0 ? maxAdvance : min_advance_amount}
              step={100}
              value={Math.min(amount, maxAdvance)}
              onChange={handleSlider}
              disabled={ewaDisabled || monthlyLimitHit || inCooldown || maxAdvance <= 0}
              className="w-full h-2 rounded-full accent-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>Min {fmt(min_advance_amount, currency)}</span>
              <span>Max {fmt(maxAdvance, currency)}</span>
            </div>
          </div>

          {/* Validation messages */}
          {belowMin && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Minimum advance is {fmt(min_advance_amount, currency)}
            </p>
          )}
          {aboveMax && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Exceeds your maximum limit of {fmt(maxAdvance, currency)}
            </p>
          )}
        </div>

        {/* Breakdown card */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Advance Breakdown</p>
            <div className="space-y-3">
              <Row label="Requested" value={fmt(amount, currency)} />
              <Row
                label={`Processing fee (${processing_fee_pct.toFixed(1)}%)`}
                value={`– ${fmt(feeAmount, currency)}`}
                valueClass="text-red-500"
              />
              <div className="border-t border-dashed border-slate-200 dark:border-slate-700 pt-3">
                <Row
                  label="You receive"
                  value={fmt(netAmount, currency)}
                  labelClass="font-bold text-slate-900 dark:text-white"
                  valueClass="font-bold text-emerald-600 text-lg"
                />
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Repayment */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">Repayment (salary deduction)</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{nextPayday}</p>
              </div>
              <span className="text-xs text-slate-400 capitalize">{payroll_cycle ?? 'monthly'}</span>
            </div>

            {/* Remaining limit */}
            <div className={cn('p-3 rounded-xl border', colors.bg)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className={cn('w-4 h-4', colors.text)} />
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Remaining limit after this request</p>
                </div>
                <p className={cn('text-sm font-bold', colors.text)}>{fmt(remaining, currency)}</p>
              </div>
              <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', colors.bar)}
                  style={{ width: `${Math.max(0, 100 - limitPct)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {fmt(amount, currency)} of {fmt(maxAdvance, currency)} used
              </p>
            </div>

            {/* Monthly advances counter */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-500">Monthly advances remaining</span>
              </div>
              <span className={cn(
                'text-sm font-bold',
                advancesLeft === 0 ? 'text-red-500' : advancesLeft === 1 ? 'text-amber-500' : 'text-emerald-600'
              )}>
                {advancesLeft} of {max_monthly_advances}
              </span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <Button
          onClick={handleRequest}
          disabled={!canRequest}
          className="w-full h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm uppercase tracking-widest shadow-lg transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          Request {fmt(amount, currency)}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>

        {canRequest && (
          <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            You&apos;re eligible — you&apos;ll receive {fmt(netAmount, currency)} after the {processing_fee_pct.toFixed(1)}% fee
          </p>
        )}
      </div>
    </EmployeePortalLayout>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Row({
  label, value, labelClass, valueClass,
}: { label: string; value: string; labelClass?: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-sm text-slate-500', labelClass)}>{label}</span>
      <span className={cn('text-sm font-semibold text-slate-900 dark:text-white tabular-nums', valueClass)}>{value}</span>
    </div>
  );
}
