'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Server,
  CreditCard,
  Smartphone,
  Database,
  Clock3,
  Gauge,
  Radio,
  Layers3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createClient } from '@supabase/supabase-js';

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

type VariantColor = 'green' | 'slate' | 'black';

interface GradientIconBoxProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  size?: 'sm' | 'md' | 'lg';
  variant?: VariantColor;
}

const GradientIconBox: React.FC<GradientIconBoxProps> = ({
  icon: Icon,
  size = 'md',
  variant = 'green',
}) => {
  const sizes = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-14 h-14',
  };
  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7',
  };
  const variants: Record<VariantColor, string> = {
    green: 'from-emerald-500 to-teal-700 shadow-emerald-500/20',
    slate: 'from-amber-500 to-orange-600 shadow-amber-500/20',
    black: 'from-rose-600 to-slate-950 shadow-rose-500/20',
  };

  return (
    <div
      className={cn(
        'rounded-xl flex items-center justify-center bg-linear-to-br shadow-lg',
        sizes[size],
        variants[variant],
      )}
    >
      <Icon className={cn('text-white', iconSizes[size])} />
    </div>
  );
};

interface StatusIndicatorProps {
  status: APIStatus;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  const statusConfig: Record<
    APIStatus,
    {
      color: string;
      label: string;
      icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    }
  > = {
    healthy: { color: 'bg-emerald-500', label: 'Healthy', icon: CheckCircle2 },
    degraded: { color: 'bg-amber-500', label: 'Degraded', icon: AlertTriangle },
    down: { color: 'bg-rose-500', label: 'Down', icon: XCircle },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold',
        status === 'healthy' &&
          'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
        status === 'degraded' &&
          'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
        status === 'down' &&
          'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
      )}
    >
      <div
        className={cn(
          'w-2 h-2 rounded-full',
          config.color,
          status === 'healthy' && 'animate-pulse',
        )}
      />
      <Icon className="h-4 w-4" />
      {config.label}
    </div>
  );
};

interface APICardProps {
  api: APIIntegration;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const APICard: React.FC<APICardProps> = ({ api, icon: Icon }) => {
  const statusVariant: VariantColor =
    api.status === 'healthy' ? 'green' : api.status === 'degraded' ? 'slate' : 'black';

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
      <div
        className={cn(
          'h-1 w-full',
          api.status === 'healthy' && 'bg-emerald-500',
          api.status === 'degraded' && 'bg-amber-500',
          api.status === 'down' && 'bg-rose-500',
        )}
      />

      <div className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <GradientIconBox icon={Icon} size="md" variant={statusVariant} />
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-slate-950 dark:text-white">
                {api.name}
              </h3>
              <p className="text-sm text-slate-500">{api.provider}</p>
            </div>
          </div>
          <StatusIndicator status={api.status} />
        </div>

        <div className="my-5 grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          <div className="px-3 py-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Latency
            </p>
            <p
              className={cn(
                'text-lg font-bold',
                api.latency_ms < 150
                  ? 'text-emerald-600'
                  : api.latency_ms < 300
                    ? 'text-amber-600'
                    : 'text-rose-600',
              )}
            >
              {api.latency_ms}ms
            </p>
          </div>
          <div className="px-3 py-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Uptime
            </p>
            <p
              className={cn(
                'text-lg font-bold',
                api.uptime_percent >= 99.5
                  ? 'text-emerald-600'
                  : api.uptime_percent >= 98
                    ? 'text-amber-600'
                    : 'text-rose-600',
              )}
            >
              {api.uptime_percent}%
            </p>
          </div>
          <div className="px-3 py-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Today
            </p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {api.transactions_today || api.syncs_today || 0}
            </p>
          </div>
        </div>

        {api.name === 'System Metrics' && api.metadata && (
          <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
            <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
              System Information
            </h4>
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Memory Usage:</span>
                <span className="font-medium">{Number(api.metadata.memory_usage_mb)}MB</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Total Memory:</span>
                <span className="font-medium">{Number(api.metadata.memory_total_mb)}MB</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Uptime:</span>
                <span className="font-medium">
                  {Math.floor(Number(api.metadata.uptime_seconds) / 3600)}h{' '}
                  {Math.floor((Number(api.metadata.uptime_seconds) % 3600) / 60)}m
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Process ID:</span>
                <span className="font-medium">{process.pid}</span>
              </div>
            </div>
          </div>
        )}

        {api.metadata && Object.keys(api.metadata).length > 0 && api.name !== 'System Metrics' && (
          <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
            <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Additional Information
            </h4>
            <div className="space-y-2 text-xs">
              {Object.entries(api.metadata).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3">
                  <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}:</span>
                  <span className="wrap-break-word text-right font-medium">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
          <span className="flex items-center gap-2 text-slate-500">
            <Clock3 className="h-4 w-4" />
            Last checked
          </span>
          <span className="text-slate-700 dark:text-slate-300">
            {new Date(api.last_check).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </article>
  );
};

interface OverallHealthBannerProps {
  status: APIStatus;
  integrations: APIIntegration[];
}

const OverallHealthBanner: React.FC<OverallHealthBannerProps> = ({
  status,
  integrations,
}) => {
  const healthyCount = integrations.filter(i => i.status === 'healthy').length;
  const totalCount = integrations.length;
  const degradedCount = integrations.filter(i => i.status === 'degraded').length;
  const downCount = integrations.filter(i => i.status === 'down').length;
  const averageLatency = totalCount
    ? Math.round(integrations.reduce((sum, api) => sum + api.latency_ms, 0) / totalCount)
    : 0;
  const averageUptime = totalCount
    ? (integrations.reduce((sum, api) => sum + api.uptime_percent, 0) / totalCount).toFixed(2)
    : '0.00';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-slate-950',
        status === 'healthy' && 'border-emerald-200 dark:border-emerald-500/30',
        status === 'degraded' && 'border-amber-200 dark:border-amber-500/30',
        status === 'down' && 'border-rose-200 dark:border-rose-500/30',
      )}
    >
      <div className="grid gap-0 lg:grid-cols-[1.35fr_1fr]">
        <div
          className={cn(
            'p-6',
            status === 'healthy' && 'bg-emerald-50/80 dark:bg-emerald-500/10',
            status === 'degraded' && 'bg-amber-50/80 dark:bg-amber-500/10',
            status === 'down' && 'bg-rose-50/80 dark:bg-rose-500/10',
          )}
        >
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-lg',
                status === 'healthy' && 'bg-emerald-100 dark:bg-emerald-500/20',
                status === 'degraded' && 'bg-amber-100 dark:bg-amber-500/20',
                status === 'down' && 'bg-rose-100 dark:bg-rose-500/20',
              )}
            >
              {status === 'healthy' && <CheckCircle2 className="h-7 w-7 text-emerald-600" />}
              {status === 'degraded' && <AlertTriangle className="h-7 w-7 text-amber-600" />}
              {status === 'down' && <XCircle className="h-7 w-7 text-rose-600" />}
            </div>
            <div>
              <h2
                className={cn(
                  'text-2xl font-bold tracking-tight',
                  status === 'healthy' && 'text-emerald-950 dark:text-emerald-100',
                  status === 'degraded' && 'text-amber-950 dark:text-amber-100',
                  status === 'down' && 'text-rose-950 dark:text-rose-100',
                )}
              >
                {status === 'healthy' && 'All Systems Operational'}
                {status === 'degraded' && 'Some Systems Degraded'}
                {status === 'down' && 'System Outage Detected'}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {healthyCount} of {totalCount} integrations are healthy
              </p>
              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {downCount} down - {degradedCount} degraded
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-t border-slate-200 dark:divide-slate-800 dark:border-slate-800 lg:border-l lg:border-t-0">
          <div className="p-4">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Healthy
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
              {healthyCount}
            </p>
          </div>
          <div className="p-4">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Degraded
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
              {degradedCount}
            </p>
          </div>
          <div className="p-4">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <Gauge className="h-4 w-4 text-cyan-500" />
              Avg Latency
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
              {averageLatency}ms
            </p>
          </div>
          <div className="p-4">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <Radio className="h-4 w-4 text-indigo-500" />
              Avg Uptime
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
              {averageUptime}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AdminAPIHealth() {
  const [data, setData] = useState<APIHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/check-api-health');
      if (res.ok) {
        const result: APIHealthData = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error('[AdminAPIHealth] fetch failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel('api-health-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'api_health' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const getIcon = (name: string): React.ComponentType<React.SVGProps<SVGSVGElement>> => {
    const lower = name.toLowerCase();
    if (lower.includes('mpesa') || lower.includes('mobile')) return Smartphone;
    if (lower.includes('bank')) return CreditCard;
    if (lower.includes('payroll') || lower.includes('vercel')) return Server;
    if (lower.includes('supabase')) return Database;
    if (lower.includes('twilio') || lower.includes('cellulant')) return Activity;
    if (lower.includes('redis') || lower.includes('cache')) return Database;
    if (lower.includes('resend') || lower.includes('email')) return Activity;
    if (lower.includes('pusher') || lower.includes('websocket')) return Activity;
    if (lower.includes('system') || lower.includes('metrics')) return Server;
    return Activity;
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
          Checking service health
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
              <Layers3 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  API Health Monitor
                </h1>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Real-time status of all integrated services
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full justify-center border-slate-300 bg-white shadow-sm hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
            {refreshing ? 'Checking...' : 'Force Check Now'}
          </Button>
        </div>
      </div>

      <OverallHealthBanner
        status={data?.overall_status || 'healthy'}
        integrations={data?.integrations || []}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        {data?.integrations?.map((api, index) => (
          <APICard key={index} api={api} icon={getIcon(api.name)} />
        ))}
      </div>

      {data?.last_updated && (
        <div className="text-center text-sm text-slate-500 dark:text-slate-400">
          Last updated: {new Date(data.last_updated).toLocaleString()}
        </div>
      )}
    </div>
  );
}
