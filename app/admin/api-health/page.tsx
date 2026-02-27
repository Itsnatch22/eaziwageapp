'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw,
  Server, CreditCard, Smartphone,
  Database,
} from 'lucide-react';
import { Button }            from '@/components/ui/button';
import { AdminPortalLayout } from '@/components/admin/AdminLayout';
import { cn }                from '@/lib/utils';
import { createClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

type APIStatus = 'healthy' | 'degraded' | 'down';

interface APIIntegration {
  name:               string;
  provider:           string;
  status:             APIStatus;
  latency_ms:         number;
  uptime_percent:     number;
  transactions_today?: number;
  syncs_today?:       number;
  last_check:         string;
}

interface APIHealthData {
  overall_status: APIStatus;
  integrations:   APIIntegration[];
  last_updated:   string;
}

type VariantColor = 'green' | 'slate' | 'black';

// ─── Sub-components ───────────────────────────────────────────────────────────

interface GradientIconBoxProps {
  icon:     React.ComponentType<React.SVGProps<SVGSVGElement>>;
  size?:    'sm' | 'md' | 'lg';
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
    green: 'from-green-600 to-green-700 shadow-green-500/25',
    slate: 'from-slate-600 to-slate-800 shadow-slate-500/25',
    black: 'from-slate-800 to-black shadow-black/25',
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
  const statusConfig: Record<APIStatus, { 
    color: string; 
    label: string; 
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  }> = {
    healthy:  { color: 'bg-green-500', label: 'Healthy',  icon: CheckCircle2 },
    degraded: { color: 'bg-slate-500', label: 'Degraded', icon: AlertTriangle },
    down:     { color: 'bg-slate-600', label: 'Down',     icon: XCircle },
  };

  const config = statusConfig[status];
  const Icon   = config.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
        status === 'healthy'  && 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300',
        status === 'degraded' && 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300',
        status === 'down'     && 'bg-slate-200 dark:bg-slate-600/20 text-slate-800 dark:text-slate-400',
      )}
    >
      <div
        className={cn(
          'w-2 h-2 rounded-full',
          config.color,
          status === 'healthy' && 'animate-pulse',
        )}
      />
      {config.label}
    </div>
  );
};

interface APICardProps {
  api:  APIIntegration;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const APICard: React.FC<APICardProps> = ({ api, icon: Icon }) => {
  const statusVariant: VariantColor = 
    api.status === 'healthy'  ? 'green' :
    api.status === 'degraded' ? 'slate' : 'black';

  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <GradientIconBox icon={Icon} size="md" variant={statusVariant} />
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">{api.name}</h3>
            <p className="text-sm text-slate-500">{api.provider}</p>
          </div>
        </div>
        <StatusIndicator status={api.status} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl text-center">
          <p className="text-xs text-slate-500">Latency</p>
          <p
            className={cn(
              'text-lg font-bold',
              api.latency_ms < 150
                ? 'text-green-600'
                : api.latency_ms < 300
                ? 'text-slate-600'
                : 'text-slate-700',
            )}
          >
            {api.latency_ms}ms
          </p>
        </div>
        <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl text-center">
          <p className="text-xs text-slate-500">Uptime</p>
          <p
            className={cn(
              'text-lg font-bold',
              api.uptime_percent >= 99.5
                ? 'text-green-600'
                : api.uptime_percent >= 98
                ? 'text-slate-600'
                : 'text-slate-700',
            )}
          >
            {api.uptime_percent}%
          </p>
        </div>
        <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl text-center">
          <p className="text-xs text-slate-500">Today</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {api.transactions_today || api.syncs_today || 0}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Last checked</span>
        <span className="text-slate-700 dark:text-slate-300">
          {new Date(api.last_check).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

interface OverallHealthBannerProps {
  status:       APIStatus;
  integrations: APIIntegration[];
}

const OverallHealthBanner: React.FC<OverallHealthBannerProps> = ({ 
  status, 
  integrations,
}) => {
  const healthyCount = integrations.filter(i => i.status === 'healthy').length;
  const totalCount   = integrations.length;
  
  return (
    <div
      className={cn(
        'rounded-2xl p-6 border',
        status === 'healthy'  && 'bg-green-50 dark:bg-green-900/20 border-green-200/50 dark:border-green-700/30',
        status === 'degraded' && 'bg-slate-100 dark:bg-slate-900/20 border-slate-200/50 dark:border-slate-700/30',
        status === 'down'     && 'bg-slate-200 dark:bg-slate-900/20 border-slate-300/50 dark:border-slate-700/30',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center',
              status === 'healthy'  && 'bg-green-100 dark:bg-green-500/20',
              status === 'degraded' && 'bg-slate-100 dark:bg-slate-500/20',
              status === 'down'     && 'bg-slate-200 dark:bg-slate-600/20',
            )}
          >
            {status === 'healthy'  && <CheckCircle2 className="w-8 h-8 text-green-600" />}
            {status === 'degraded' && <AlertTriangle className="w-8 h-8 text-slate-600" />}
            {status === 'down'     && <XCircle className="w-8 h-8 text-slate-700" />}
          </div>
          <div>
            <h2
              className={cn(
                'text-2xl font-bold',
                status === 'healthy'  && 'text-green-900 dark:text-green-100',
                status === 'degraded' && 'text-slate-900 dark:text-slate-100',
                status === 'down'     && 'text-slate-900 dark:text-slate-100',
              )}
            >
              {status === 'healthy'  && 'All Systems Operational'}
              {status === 'degraded' && 'Some Systems Degraded'}
              {status === 'down'     && 'System Outage Detected'}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {healthyCount} of {totalCount} integrations are healthy
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{healthyCount}</p>
            <p className="text-xs text-slate-500">Healthy</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-slate-600">
              {integrations.filter(i => i.status === 'degraded').length}
            </p>
            <p className="text-xs text-slate-500">Degraded</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-slate-700">
              {integrations.filter(i => i.status === 'down').length}
            </p>
            <p className="text-xs text-slate-500">Down</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

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

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // REAL-TIME SUBSCRIPTION (this is the magic)
  useEffect(() => {
    const channel = supabase
      .channel('api-health-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'api_health' },
        () => {
          fetchData(); // instant UI update
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

  // getIcon stays exactly the same
  const getIcon = (name: string): React.ComponentType<React.SVGProps<SVGSVGElement>> => {
    const lower = name.toLowerCase();
    if (lower.includes('mpesa') || lower.includes('mobile')) return Smartphone;
    if (lower.includes('bank')) return CreditCard;
    if (lower.includes('payroll') || lower.includes('vercel')) return Server;
    if (lower.includes('supabase')) return Database;
    if (lower.includes('twilio') ||  lower.includes('cellulant')) return Activity;
    return Activity;
  };

  if (loading) {
    return (
      <AdminPortalLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-14 h-14 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
        </div>
      </AdminPortalLayout>
    );
  }

  return (
    <AdminPortalLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              API Health Monitor
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              Real-time status of all integrated services
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </p>
          </div>

          <Button 
            variant="outline" 
            className="bg-white/60 dark:bg-slate-800/60"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} /> 
            {refreshing ? 'Checking...' : 'Force Check Now'}
          </Button>
        </div>

        {/* Banner & Grid stay exactly as you wrote them */}
        <OverallHealthBanner 
          status={data?.overall_status || 'healthy'}
          integrations={data?.integrations || []}
        />

        <div className="grid sm:grid-cols-2 gap-6">
          {data?.integrations?.map((api, index) => (
            <APICard 
              key={index}
              api={api}
              icon={getIcon(api.name)}
            />
          ))}
        </div>

        {data?.last_updated && (
          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            Last updated: {new Date(data.last_updated).toLocaleString()}
          </div>
        )}
      </div>
    </AdminPortalLayout>
  );
}
