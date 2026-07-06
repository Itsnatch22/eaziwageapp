'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Wallet, CheckCircle2, AlertTriangle, XCircle, HelpCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type PublicStatus = 'operational' | 'degraded' | 'down' | 'unknown';

interface ServiceStatus {
  name: string;
  status: PublicStatus;
}

interface RecentIncident {
  date: string;
  status: PublicStatus;
  note: string | null;
}

interface StatusResponse {
  overall_status: PublicStatus;
  services: ServiceStatus[];
  uptime_90d_percent: number | null;
  recent_incidents: RecentIncident[];
  last_updated: string;
}

const STATUS_CONFIG: Record<PublicStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  operational: { label: 'Operational', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800', icon: CheckCircle2 },
  degraded:    { label: 'Degraded Performance', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', icon: AlertTriangle },
  down:        { label: 'Down', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', icon: XCircle },
  unknown:     { label: 'Unknown', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700', icon: HelpCircle },
};

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/public/status', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load status');
      const json: StatusResponse = await res.json();
      setData(json);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStatus();
    const interval = setInterval(fetchStatus, 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const overall = data?.overall_status ?? 'unknown';
  const overallConfig = STATUS_CONFIG[overall];
  const OverallIcon = overallConfig.icon;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(22,163,74,0.06)_0%,transparent_60%)] pointer-events-none" />

      <main className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-12 h-12 bg-linear-to-br from-emerald-500/20 to-green-500/20 ring-1 ring-emerald-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/10 border border-slate-100 dark:border-slate-800">
              <Wallet className="h-8 w-8 text-emerald-700" strokeWidth={2} aria-hidden="true" />
            </div>
            <span className="font-bold text-2xl text-slate-900 dark:text-white tracking-tight">EaziWage</span>
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-8">System Status</h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : error || !data ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center">
            <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">Unable to load status right now. Please try again shortly.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={cn('rounded-2xl border p-6 flex items-center gap-4', overallConfig.bg)}>
              <OverallIcon className={cn('w-8 h-8 shrink-0', overallConfig.color)} />
              <div>
                <p className={cn('font-bold text-lg', overallConfig.color)}>
                  {overall === 'operational' ? 'All Systems Operational' : `Systems ${overallConfig.label}`}
                </p>
                {data.uptime_90d_percent !== null && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {data.uptime_90d_percent}% uptime over the last 90 days
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {data.services.map((service) => {
                const cfg = STATUS_CONFIG[service.status];
                const Icon = cfg.icon;
                return (
                  <div key={service.name} className="flex items-center justify-between px-5 py-4">
                    <span className="font-medium text-slate-900 dark:text-white">{service.name}</span>
                    <span className={cn('flex items-center gap-1.5 text-sm font-semibold', cfg.color)}>
                      <Icon className="w-4 h-4" />
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {data.recent_incidents.length > 0 && (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">Recent Incidents</h2>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                  {data.recent_incidents.map((incident) => {
                    const cfg = STATUS_CONFIG[incident.status];
                    return (
                      <div key={incident.date} className="px-5 py-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{incident.date}</span>
                          <span className={cn('text-xs font-bold uppercase', cfg.color)}>{cfg.label}</span>
                        </div>
                        {incident.note && <p className="text-xs text-slate-500 dark:text-slate-400">{incident.note}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-center text-xs text-slate-400">
              Last updated {new Date(data.last_updated).toLocaleString()} &middot; refreshes automatically every minute
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
