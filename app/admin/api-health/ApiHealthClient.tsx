'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw,
  Server, CreditCard, Smartphone, Database, Clock3, Gauge,
  Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/realtime-js';

type APIStatus = 'healthy' | 'degraded' | 'down';
type APIMetadataValue = string | number | boolean | null | object;

interface APIIntegration {
  name: string;
  provider: string;
  status: APIStatus;
  latency_ms: number;
  uptime_percent: number;
  transactions_today?: number;
  syncs_today?: number;
  last_check: string;
  metadata?: Record<string, APIMetadataValue>;
}

interface APIHealthData {
  overall_status: APIStatus;
  integrations: APIIntegration[];
  last_updated: string;
}

// ── shared design tokens ──────────────────────────────────────────────────────

type IconVariant = 'purple' | 'green' | 'amber' | 'red' | 'blue';
type IconComponent = React.ComponentType<{ className?: string }>;

const GradientIconBox = ({
  icon: Icon,
  size = 'md',
  variant = 'purple',
}: {
  icon: IconComponent;
  size?: 'sm' | 'md' | 'lg';
  variant?: IconVariant;
}) => {
  const sizes  = { sm: 'w-10 h-10', md: 'w-12 h-12', lg: 'w-14 h-14' };
  const icons  = { sm: 'w-5 h-5',   md: 'w-6 h-6',   lg: 'w-7 h-7'   };
  const colors: Record<IconVariant, string> = {
    purple: 'from-purple-600 to-purple-700',
    green:  'from-emerald-500 to-emerald-600',
    amber:  'from-amber-500 to-amber-600',
    red:    'from-red-500 to-red-600',
    blue:   'from-blue-500 to-blue-600',
  };
  return (
    <div className={cn('rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg', sizes[size], colors[variant])}>
      <Icon className={cn('text-white', icons[size])} />
    </div>
  );
};

const card = 'bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30';

// ── status badge ──────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: APIStatus }) => {
  const cfg: Record<APIStatus, { bg: string; text: string; dot: string; label: string; Icon: IconComponent }> = {
    healthy:  { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', label: 'Healthy',  Icon: CheckCircle2  },
    degraded: { bg: 'bg-amber-100 dark:bg-amber-500/20',     text: 'text-amber-700 dark:text-amber-300',     dot: 'bg-amber-500',   label: 'Degraded', Icon: AlertTriangle },
    down:     { bg: 'bg-red-100 dark:bg-red-500/20',         text: 'text-red-700 dark:text-red-300',         dot: 'bg-red-500',     label: 'Down',     Icon: XCircle       },
  };
  const { bg, text, dot, label, Icon } = cfg[status];
  return (
    <span className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold', bg, text)}>
      <span className={cn('w-2 h-2 rounded-full', dot, status === 'healthy' && 'animate-pulse')} />
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
};

// ── overall health banner ─────────────────────────────────────────────────────

const OverallHealthBanner = ({ status, integrations }: { status: APIStatus; integrations: APIIntegration[] }) => {
  const healthy   = integrations.filter(i => i.status === 'healthy').length;
  const degraded  = integrations.filter(i => i.status === 'degraded').length;
  const down      = integrations.filter(i => i.status === 'down').length;
  const total     = integrations.length;
  const avgLatency = total ? Math.round(integrations.reduce((s, i) => s + i.latency_ms, 0) / total) : 0;
  const avgUptime  = total ? (integrations.reduce((s, i) => s + i.uptime_percent, 0) / total).toFixed(2) : '0.00';

  const bannerVariant: IconVariant = status === 'healthy' ? 'green' : status === 'degraded' ? 'amber' : 'red';
  const BannerIcon = status === 'healthy' ? CheckCircle2 : status === 'degraded' ? AlertTriangle : XCircle;
  const title = status === 'healthy' ? 'All Systems Operational' : status === 'degraded' ? 'Some Systems Degraded' : 'System Outage Detected';

  return (
    <div className={card}>
      <div className="grid lg:grid-cols-[1.4fr_1fr]">
        {/* left — overall status */}
        <div className="p-6 flex items-start gap-4 border-b lg:border-b-0 lg:border-r border-slate-200/50 dark:border-slate-700/30">
          <GradientIconBox icon={BannerIcon} size="lg" variant={bannerVariant} />
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {healthy} of {total} integrations healthy · {down} down · {degraded} degraded
            </p>
          </div>
        </div>

        {/* right — four stats */}
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-200/50 dark:divide-slate-700/30">
          {[
            { Icon: CheckCircle2, label: 'Healthy',     value: healthy,        color: 'text-emerald-600' },
            { Icon: AlertTriangle,label: 'Degraded',    value: degraded,       color: 'text-amber-600'   },
            { Icon: Gauge,        label: 'Avg Latency', value: `${avgLatency}ms`, color: 'text-slate-900 dark:text-white' },
            { Icon: Radio,        label: 'Avg Uptime',  value: `${avgUptime}%`,   color: 'text-slate-900 dark:text-white' },
          ].map(({ Icon, label, value, color }) => (
            <div key={label} className="p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                <Icon className="w-3.5 h-3.5" /> {label}
              </p>
              <p className={cn('text-2xl font-bold mt-2', color)}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── individual API card ───────────────────────────────────────────────────────

const APICard = ({ api, icon }: { api: APIIntegration; icon: IconComponent }) => {
  const variant: IconVariant = api.status === 'healthy' ? 'green' : api.status === 'degraded' ? 'amber' : 'red';

  const latencyColor = api.latency_ms < 150 ? 'text-emerald-600' : api.latency_ms < 300 ? 'text-amber-600' : 'text-red-600';
  const uptimeColor  = api.uptime_percent >= 99.5 ? 'text-emerald-600' : api.uptime_percent >= 98 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className={cn(card, 'overflow-hidden')}>
      {/* status stripe */}
      <div className={cn('h-1', api.status === 'healthy' ? 'bg-emerald-500' : api.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500')} />

      <div className="p-5">
        {/* header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <GradientIconBox icon={icon} size="md" variant={variant} />
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-white truncate">{api.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{api.provider}</p>
            </div>
          </div>
          <StatusBadge status={api.status} />
        </div>

        {/* metrics row */}
        <div className="mt-5 grid grid-cols-3 rounded-xl border border-slate-200/50 dark:border-slate-700/30 divide-x divide-slate-200/50 dark:divide-slate-700/30">
          {[
            { label: 'Latency',  value: `${api.latency_ms}ms`,                     color: latencyColor },
            { label: 'Uptime',   value: `${api.uptime_percent}%`,                   color: uptimeColor  },
            { label: 'Today',    value: api.transactions_today ?? api.syncs_today ?? 0, color: 'text-slate-900 dark:text-white' },
          ].map(({ label, value, color }) => (
            <div key={label} className="py-3 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">{label}</p>
              <p className={cn('text-base font-bold mt-1', color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* metadata */}
        {api.metadata && Object.keys(api.metadata).length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/30">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
              {api.name === 'System Metrics' ? 'System Information' : 'Additional Details'}
            </p>
            <div className="grid gap-1.5 text-xs sm:grid-cols-2">
              {api.name === 'System Metrics'
                ? [
                    ['Memory Usage', `${Number(api.metadata.memory_usage_mb)}MB`],
                    ['Total Memory', `${Number(api.metadata.memory_total_mb)}MB`],
                    ['Uptime', `${Math.floor(Number(api.metadata.uptime_seconds) / 3600)}h ${Math.floor((Number(api.metadata.uptime_seconds) % 3600) / 60)}m`],
                    ['Process ID', String(process.pid)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="text-slate-500">{k}:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{v}</span>
                    </div>
                  ))
                : Object.entries(api.metadata).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 break-all text-right">
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </span>
                    </div>
                  ))}
            </div>
          </div>
        )}

        {/* footer */}
        <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/30 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5" /> Last checked</span>
          <span>{new Date(api.last_check).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

// ── icon map ──────────────────────────────────────────────────────────────────

const getIcon = (name: string): IconComponent => {
  const n = name.toLowerCase();
  if (n.includes('mpesa') || n.includes('mobile')) return Smartphone;
  if (n.includes('bank'))                           return CreditCard;
  if (n.includes('payroll') || n.includes('vercel')) return Server;
  if (n.includes('supabase') || n.includes('redis') || n.includes('cache')) return Database;
  if (n.includes('system') || n.includes('metrics')) return Server;
  return Activity;
};

// ── page ──────────────────────────────────────────────────────────────────────

export default function AdminAPIHealth() {
  const [data, setData] = useState<APIHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  );

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/check-api-health');
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error('[AdminAPIHealth] fetch failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(fetchData, 0);
    return () => window.clearTimeout(t);
  }, [fetchData]);

  useEffect(() => {
    type S = { channel: (n: string) => RealtimeChannel; removeChannel: (c: RealtimeChannel) => void };
    const ch = (supabase as unknown as S)
      .channel('api-health-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'api_health' }, fetchData)
      .subscribe();
    return () => (supabase as unknown as S).removeChannel(ch);
  }, [fetchData, supabase]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/admin/check-api-health', { method: 'POST' });
      await fetchData();
    } catch (err) {
      console.error('[AdminAPIHealth] refresh failed:', err);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">API Health Monitor</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time status of all integrated services</p>
        </div>
        <Button
          variant="outline"
          className="bg-white/60 dark:bg-slate-800/60"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} />
          {refreshing ? 'Checking…' : 'Force Check Now'}
        </Button>
      </div>

      {/* overall banner */}
      <OverallHealthBanner
        status={data?.overall_status ?? 'healthy'}
        integrations={data?.integrations ?? []}
      />

      {/* integration cards */}
      <div className="grid gap-4 xl:grid-cols-2">
        {(data?.integrations ?? []).map((api, i) => (
          <APICard key={i} api={api} icon={getIcon(api.name)} />
        ))}
      </div>

      {/* last updated footer */}
      {data?.last_updated && (
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 pb-2">
          Last updated: {new Date(data.last_updated).toLocaleString()}
        </p>
      )}
    </div>
  );
}
