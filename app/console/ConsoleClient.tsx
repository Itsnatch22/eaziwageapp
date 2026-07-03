'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, AlertTriangle, ShieldAlert, Wallet, Send, RefreshCw, Clock, LogOut, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { logout } from '@/actions/auth';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { cn } from '@/lib/utils';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 min — shorter than the rest of the app

interface ConsoleContext {
  health: {
    apiHealth: Array<Record<string, unknown>>;
    recentErrors: Array<Record<string, unknown>>;
    incidents: Array<Record<string, unknown>>;
  };
  security: {
    logins: Array<Record<string, unknown>>;
    failedLogins: Array<Record<string, unknown>>;
    devices: Array<Record<string, unknown>>;
    fraud: Array<Record<string, unknown>>;
    fraudRules: Array<Record<string, unknown>>;
  };
  payments: {
    dusupay: Array<Record<string, unknown>>;
    wallets: Array<Record<string, unknown>>;
    walletTx: Array<Record<string, unknown>>;
    payroll: Array<Record<string, unknown>>;
    payoutProviders: Array<Record<string, unknown>>;
  };
  generatedAt: string;
}

const SECTION_COLORS = {
  purple: 'from-purple-600 to-indigo-600 shadow-purple-500/25',
  rose: 'from-rose-500 to-orange-500 shadow-rose-500/25',
  red: 'from-red-500 to-rose-600 shadow-red-500/25',
  emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/25',
} as const;

function SectionCard({
  title, icon: Icon, children, timestamp, color = 'purple',
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  timestamp?: string;
  color?: keyof typeof SECTION_COLORS;
}) {
  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center bg-linear-to-br shadow-lg', SECTION_COLORS[color])}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        </div>
        {timestamp && (
          <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {new Date(timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function StatRow({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'ok' | 'warn' | 'bad' }) {
  const toneClass = tone === 'bad'
    ? 'text-red-500 dark:text-red-400'
    : tone === 'warn'
      ? 'text-amber-500 dark:text-amber-400'
      : 'text-slate-800 dark:text-slate-100';
  return (
    <div className="flex items-center justify-between py-1.5 text-sm border-b border-slate-100 dark:border-slate-800/60 last:border-0">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={cn('font-mono font-medium', toneClass)}>{value}</span>
    </div>
  );
}

export default function ConsoleClient() {
  const router = useRouter();
  const [context, setContext] = useState<ConsoleContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/console/summary');
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.error || 'Failed to load console data';
        setLoadError(message);
        setContext(null);
        toast.error(message);
        return;
      }
      setContext(data);
    } catch {
      setLoadError('Failed to reach the console API');
      setContext(null);
      toast.error('Failed to load console data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => void fetchSummary());
  }, [fetchSummary]);

  const handleIdle = useCallback(async () => {
    toast.info('Console session timed out from inactivity');
    // logout() itself redirects to '/' via next/navigation's redirect(), which
    // throws internally — no need to also router.push after calling it.
    await logout();
  }, []);

  useIdleTimeout(IDLE_TIMEOUT_MS, handleIdle);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setAnswer(null);
    try {
      const res = await fetch('/api/console/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to get a summary');
        return;
      }
      setAnswer(data.summary);
    } catch {
      toast.error('Failed to get a summary');
    } finally {
      setAsking(false);
    }
  };

  if (loading && !context) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-purple-500 animate-spin" />
      </div>
    );
  }

  // Deliberately not falling through to the zeroed-out dashboard below when
  // data failed to load — showing "0 errors, 0 fraud alerts" when the real
  // situation is "the console couldn't reach the database" is exactly the
  // kind of false negative an incident-response tool must never produce.
  if (!context) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/25 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Wiza didn&apos;t make it to the desk</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{loadError || 'Unknown error'}</p>
          <button
            onClick={fetchSummary}
            className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> Try again
          </button>
        </div>
      </div>
    );
  }

  const errorCount = context?.health.recentErrors.reduce((sum, r) => sum + Number(r.occurrences ?? 0), 0) ?? 0;
  const activeFraud = context?.security.fraud.filter((f) => f.status !== 'resolved') ?? [];
  const failedLoginTotal = context?.security.failedLogins.reduce((sum, r) => sum + Number(r.attempt_count ?? 0), 0) ?? 0;
  const walletSummary = context?.payments.wallets[0];
  const allClear = errorCount === 0 && activeFraud.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-linear-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Founder Ops Console
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300">
                just for you
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {allClear ? "All quiet — nothing's on fire. " : ''}Read-only · founder-only · dozes off after 15 min idle
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSummary}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
          </button>
          <button
            onClick={() => router.push('/admin')}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Exit
          </button>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-7xl mx-auto">
        <SectionCard title="System Health" icon={Activity} timestamp={context?.generatedAt} color="purple">
          <StatRow label="Error occurrences (7d)" value={errorCount} tone={errorCount > 20 ? 'bad' : errorCount > 0 ? 'warn' : 'ok'} />
          <StatRow label="Distinct error signatures" value={context?.health.recentErrors.length ?? 0} />
          <StatRow label="Open incidents" value={context?.health.incidents.filter((i) => i.status !== 'resolved').length ?? 0}
            tone={(context?.health.incidents.filter((i) => i.status !== 'resolved').length ?? 0) > 0 ? 'bad' : 'ok'} />
          {(context?.health.apiHealth ?? []).slice(0, 6).map((h, i) => (
            <StatRow
              key={i}
              label={String(h.name)}
              value={`${h.status} · ${h.latency_ms ?? '—'}ms`}
              tone={h.status === 'operational' || h.status === 'healthy' ? 'ok' : h.status === 'degraded' ? 'warn' : 'bad'}
            />
          ))}
        </SectionCard>

        <SectionCard title="Recent Errors & Incidents" icon={AlertTriangle} timestamp={context?.generatedAt} color="rose">
          {(context?.health.recentErrors ?? []).slice(0, 6).map((e, i) => (
            <StatRow key={i} label={String(e.message).slice(0, 50)} value={`×${e.occurrences}`} tone="warn" />
          ))}
          {(context?.health.recentErrors.length ?? 0) === 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-2">Nothing broke in the last 7 days. Suspicious, but I&apos;ll take it.</p>
          )}
          {(context?.health.incidents ?? []).slice(0, 3).map((inc, i) => (
            <StatRow key={`inc-${i}`} label={`Incident ${inc.date}`} value={String(inc.status)} tone={inc.status === 'resolved' ? 'ok' : 'bad'} />
          ))}
        </SectionCard>

        <SectionCard title="Fraud & Security Signals" icon={ShieldAlert} timestamp={context?.generatedAt} color="red">
          <StatRow label="Active fraud flags/alerts" value={activeFraud.length} tone={activeFraud.length > 0 ? 'bad' : 'ok'} />
          <StatRow label="Failed logins (30d)" value={failedLoginTotal} tone={failedLoginTotal > 20 ? 'warn' : 'ok'} />
          <StatRow label="Trusted devices" value={Number(context?.security.devices[0]?.total_devices ?? 0)} />
          <StatRow label="Devices added (7d)" value={Number(context?.security.devices[0]?.added_last_7d ?? 0)} />
          <StatRow label="Active fraud rules" value={context?.security.fraudRules.filter((r) => r.enabled).reduce((s, r) => s + Number(r.rule_count ?? 0), 0) ?? 0} />
        </SectionCard>

        <SectionCard title="Payment Rail Health" icon={Wallet} timestamp={context?.generatedAt} color="emerald">
          <StatRow label="Admin wallet balance (USD)" value={Number(walletSummary?.total_admin_balance_usd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} />
          <StatRow label="Employer wallets" value={Number(walletSummary?.employer_wallet_count ?? 0)} />
          <StatRow label="Total outstanding liability" value={Number(walletSummary?.total_outstanding_liability ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} />
          <StatRow
            label="DusuPay failures (30d)"
            value={context?.payments.dusupay.filter((d) => d.status === 'failed').reduce((s, d) => s + Number(d.transaction_count ?? 0), 0) ?? 0}
          />
          <StatRow
            label="Payroll integrations failing"
            value={context?.payments.payroll.filter((p) => p.last_sync_status === 'failed').reduce((s, p) => s + Number(p.integration_count ?? 0), 0) ?? 0}
            tone="warn"
          />
        </SectionCard>
      </div>

      <div className="px-6 pb-8 max-w-7xl mx-auto">
        <SectionCard title="Ask the Console" icon={Send} color="purple">
          <form onSubmit={handleAsk} className="flex gap-2 mb-3">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. anything unusual in the last 24 hours?"
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />
            <button
              type="submit"
              disabled={asking || !question.trim()}
              className="px-4 py-2 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium shadow-lg shadow-purple-500/25 disabled:opacity-40 disabled:shadow-none hover:opacity-90 transition-opacity"
            >
              {asking ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Ask'}
            </button>
          </form>
          {answer && (
            <div className="bg-purple-50/60 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{answer}</div>
          )}
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
            Scoped to system health, security/fraud signals, payment rail health, support, and audit data — never advances, employees, or repayment records.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
