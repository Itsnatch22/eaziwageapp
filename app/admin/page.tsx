'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Building2, Users, CreditCard, Shield, CheckCircle2,
  TrendingUp, ArrowRight, FileText, Wifi, Activity, AlertTriangle, 
  DollarSign, BarChart3, RefreshCw, Bell, Info, AlertCircle, CheckSquare,
} from 'lucide-react';import { formatCurrency, cn, DEFAULT_ADMIN_CURRENCY, formatDateTime } from '@/lib/utils';
import pusherClient from '@/lib/pusher-client';
import { useCurrency } from '@/hooks/useCurrency';

// Types
type VariantColor = 'green' | 'slate' | 'black';
type IconSize = 'sm' | 'md' | 'lg';
type IconComponent = React.ComponentType<{ className?: string }>;
type APIStatus = 'healthy' | 'degraded' | 'down';

interface Notification {
  id:         string;
  type:       'review_request' | 'employer_kyc' | 'flagged_advance' | 'system_alert' | 'employee';
  title:      string;
  message:    string;
  read:       boolean;
  created_at: string;
  metadata?:  Record<string, unknown>;
}

interface DashboardStats {
  employers: { total: number; active: number; trend?: string; trendUp?: boolean };
  employees: { total: number; active: number; trend?: string; trendUp?: boolean };
  advances: { total_count: number; pending_count: number; total_disbursed: number; total_fees: number };
  kyc_pending: { employers: number; employees: number };
  pending_reviews: number;
  suspicious_activity: {
    total_open: number;
    alerts: Array<{
      id: number;
      title: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | string;
      created_at: string;
    }>;
  };
  pending_reconciliation: number;
  monthly: { disbursed: number; advance_count: number; fees: number };
  risk: { avg_employer_score: number };
  api_health: Record<string, { status: APIStatus; latency_ms: number; uptime_percent: number }>;
}

// Components

interface GradientIconBoxProps {
  icon: IconComponent;
  size?: IconSize;
  variant?: VariantColor;
}

const GradientIconBox = ({ icon: Icon, size = 'md', variant = 'green' }: GradientIconBoxProps) => {
  const sizes = { sm: 'w-10 h-10', md: 'w-12 h-12', lg: 'w-14 h-14' };
  const iconSizes = { sm: 'w-5 h-5', md: 'w-6 h-6', lg: 'w-7 h-7' };
  const variants: Record<VariantColor, string> = {
    green: 'from-green-600 to-green-700 shadow-green-500/25',
    slate: 'from-slate-600 to-slate-800 shadow-slate-500/25',
    black: 'from-slate-800 to-black shadow-black/25',
  };
  return (
    <div className={cn('rounded-xl flex items-center justify-center bg-linear-to-br shadow-lg', sizes[size], variants[variant])}>
      <Icon className={cn('text-white', iconSizes[size])} />
    </div>
  );
};

interface AdminMetricCardProps {
  icon: IconComponent;
  label: string;
  value: string | number;
  subtext?: string;
  trend?: string;
  trendUp?: boolean;
  variant?: VariantColor;
}
const MetricCard = ({ icon, label, value, subtext, trend, trendUp, variant = 'green' } : AdminMetricCardProps) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30">
    <div className="flex items-start justify-between">
      <GradientIconBox icon={icon} size="md" variant={variant} />
      {trend && (
        <div className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium',
          trendUp ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                 : 'bg-slate-200 dark:bg-slate-600/20 text-slate-800 dark:text-slate-400')}>
          <TrendingUp className={cn('w-3 h-3', !trendUp && 'rotate-180')} />
          {trend}
        </div>
      )}
    </div>
    <div className="mt-4">
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
      {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
    </div>
  </div>
);

const AlertCard = ({ icon: Icon, title, count, description, link, variant }: {
  icon: IconComponent; title: string; count: number; description: string; link: string; variant: 'green'|'slate'|'black';
}) => {
  const variants = {
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200/50 dark:border-green-700/30',
    slate: 'bg-slate-100 dark:bg-slate-900/20 border-slate-200/50 dark:border-slate-700/30',
    black: 'bg-slate-200 dark:bg-slate-900/20 border-slate-300/50 dark:border-slate-700/30',
  };
  const iconColors = { green: 'text-green-600', slate: 'text-slate-600', black: 'text-slate-700' };
  return (
    <div className={cn('rounded-2xl p-4 flex items-center gap-4 border', variants[variant])}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/60 dark:bg-slate-800/60 shadow-sm">
        <Icon className={cn('w-6 h-6', iconColors[variant])} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-bold', iconColors[variant])}>{count} {title}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
      </div>
      <Link href={link}>
        <span className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground h-9 px-3", iconColors[variant])}>
          <ArrowRight className="w-4 h-4" />
        </span>
      </Link>
    </div>
  );
};

const NotificationCenter = ({ notifications }: { notifications: Notification[] }) => {
  const getNotificationConfig = (type: string) => {
    const config = {
      review_request:  { icon: Shield,        bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-600 dark:text-green-400' },
      employer_kyc:    { icon: Building2,     bg: 'bg-amber-100 dark:bg-amber-500/20',  text: 'text-amber-600' },
      flagged_advance: { icon: AlertTriangle, bg: 'bg-red-100 dark:bg-red-500/20',      text: 'text-red-600' },
      system_alert:    { icon: Bell,          bg: 'bg-blue-100 dark:bg-blue-500/20',     text: 'text-blue-600' },
      employee:        { icon: Shield,        bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-600 dark:text-green-400' },
    };
    return config[type as keyof typeof config] || config.system_alert;
  };

  // Show only the latest 4 notifications
  const recentNotifications = notifications.slice(0, 4);

  return (
    <div className="space-y-3">
      {recentNotifications.map((notification) => {
        const config = getNotificationConfig(notification.type);
        const { icon: Icon, bg, text } = config;
        
        return (
          <div 
            key={notification.id}
            className={cn(
              'p-3 rounded-xl border transition-all hover:shadow-sm',
              bg,
              !notification.read && 'bg-green-50/30 dark:bg-green-900/10'
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', bg)}>
                <Icon className={cn('w-4 h-4', text)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('font-semibold text-sm', !notification.read ? 'text-green-700 dark:text-green-400' : text)}>
                    {notification.title}
                  </p>
                  <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {formatDateTime(notification.created_at)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {notification.message}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Main
export default function AdminDashboard() {
  const { currency } = useCurrency();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [cacheStatus, setCacheStatus] = useState<'HIT' | 'MISS' | null>(null);
  const [refreshingCache, setRefreshingCache] = useState(false);
  const avgEmployerRisk = stats?.risk?.avg_employer_score ?? 3.5;

  // Define handlers before they are used
  const handleUpdate = () => {
    console.log('[Pusher] Admin dashboard update triggered');
    // Re-fetch data without showing full-page loader for better UX
    Promise.all([
      fetch('/api/admin/dashboard'),
      fetch('/api/admin/notifications')
    ]).then(async ([dashboardRes, notificationsRes]) => {
      const [dashboardData, notificationsData] = await Promise.all([
        dashboardRes.json(),
        notificationsRes.json()
      ]);
      setStats(dashboardData);
      setNotifications(notificationsData);
      // Update cache status
      const cacheHeader = dashboardRes.headers.get('X-Cache');
      setCacheStatus(cacheHeader as 'HIT' | 'MISS' | null);
    })
    .catch(err => console.error('Silent refresh failed:', err));
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const handleCacheRefresh = async () => {
    setRefreshingCache(true);
    try {
      const res = await fetch('/api/admin/dashboard', { method: 'POST' });
      if (res.ok) {
        console.log('[AdminDashboard] Cache cleared successfully');
        // After clearing cache, fetch fresh data
        const dataRes = await fetch('/api/admin/dashboard');
        if (dataRes.ok) {
          const data = await dataRes.json();
          setStats(data);
          setCacheStatus('MISS');
        }
      }
    } catch (err) {
      console.error('[AdminDashboard] Cache refresh failed:', err);
    } finally {
      setRefreshingCache(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [dashboardRes, notificationsRes] = await Promise.all([
          fetch('/api/admin/dashboard'),
          fetch('/api/admin/notifications')
        ]);
        
        if (dashboardRes.ok) {
          const data = await dashboardRes.json();
          setStats(data);
          // Set cache status from response headers
          const cacheHeader = dashboardRes.headers.get('X-Cache');
          setCacheStatus(cacheHeader as 'HIT' | 'MISS' | null);
        }
        
        if (notificationsRes.ok) {
          const notificationsData = await notificationsRes.json();
          setNotifications(notificationsData);
        }
      } catch (err) {
        console.error('[AdminDashboard] fetch failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!pusherClient) return;

    const channel = pusherClient.subscribe('admin-notifications');
    channel.bind('new-notification', (data: Notification) => {
      setNotifications((prev) => [data, ...prev]);
      // Also update dashboard stats if needed
      handleUpdate();
    });

    channel.bind('notification-deleted', (data: { id: string }) => {
      setNotifications(prev => prev.filter(n => String(n.id) !== String(data.id)));
    });

    return () => {
      channel.unbind('new-notification');
      channel.unbind('notification-deleted');
      pusherClient!.unsubscribe('admin-notifications');
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-14 h-14 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard Overview</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
            Platform-wide metrics and operations
            {cacheStatus && (
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                cacheStatus === 'HIT' 
                  ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300' 
                  : 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300'
              )}>
                <span className={cn('w-2 h-2 rounded-full', cacheStatus === 'HIT' ? 'bg-green-500' : 'bg-slate-500')} />
                Cache {cacheStatus}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 bg-white/60 dark:bg-slate-800/60"
            onClick={handleCacheRefresh}
            disabled={refreshingCache}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', refreshingCache && 'animate-spin')} /> 
            {refreshingCache ? 'Clearing Cache...' : 'Clear Cache'}
          </button>
          <Link href="/admin/reports" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 bg-white/60 dark:bg-slate-800/60">
            <BarChart3 className="w-4 h-4 mr-2" /> Reports
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {(stats && (stats.kyc_pending.employers > 0 || stats.kyc_pending.employees > 0 || stats.pending_reviews > 0)) && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.kyc_pending.employers > 0 && (
            <AlertCard icon={Building2} title="Employers" count={stats.kyc_pending.employers} description="Pending verification" link="/admin/employers?status=pending" variant="slate" />
          )}
          {stats.kyc_pending.employees > 0 && (
            <AlertCard icon={FileText} title="KYC Reviews" count={stats.kyc_pending.employees} description="Documents to review" link="/admin/kyc-review" variant="slate" />
          )}
          {stats.pending_reviews > 0 && (
            <AlertCard icon={Shield} title="Risk Reviews" count={stats.pending_reviews} description="Employer requests" link="/admin/risk-scoring" variant="green" />
          )}
        </div>
      )}

      {stats && stats.suspicious_activity.total_open > 0 && (
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <GradientIconBox icon={Shield} size="sm" variant="black" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Suspicious Activity Feed</p>
                <p className="text-xs text-slate-500">{stats.suspicious_activity.total_open} open alerts</p>
              </div>
            </div>
        <Link href="/admin/fraud-detection">
              <span className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground h-9 px-3 text-slate-700">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </span>
            </Link>
          </div>
          <div className="space-y-2">
            {stats.suspicious_activity.alerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/40">
                <AlertTriangle className={cn(
                  'w-4 h-4 mt-0.5',
                  alert.severity === 'high' ? 'text-red-600' : alert.severity === 'medium' ? 'text-amber-600' : 'text-slate-600'
                )} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{alert.title}</p>
                  <p className="text-xs text-slate-500 truncate">{alert.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Building2} label="Total Employers" value={stats?.employers.total || 0} subtext={`${stats?.employers.active || 0} active`} trend={stats?.employers.trend} trendUp={stats?.employers.trendUp} variant="green" />
        <MetricCard icon={Users} label="Total Employees" value={stats?.employees.total || 0} subtext={`${stats?.employees.active || 0} active`} trend={stats?.employees.trend} trendUp={stats?.employees.trendUp} variant="slate" />
        <MetricCard icon={CreditCard} label="Total Advances" value={stats?.advances.total_count || 0} subtext={`${stats?.advances.pending_count || 0} pending`} variant="green" />
        <MetricCard icon={DollarSign} label="Total Disbursed" value={formatCurrency(stats?.advances.total_disbursed || 0, DEFAULT_ADMIN_CURRENCY)} subtext={`Fees: ${formatCurrency(stats?.advances.total_fees || 0, DEFAULT_ADMIN_CURRENCY)}`} variant="slate" />
      </div>

      {/* Secondary */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center gap-3 mb-6">
            <GradientIconBox icon={Activity} size="md" variant="green" />
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Monthly Performance</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Current month statistics</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-4 bg-linear-to-br from-green-500/5 to-green-600/5 dark:from-green-500/10 dark:to-green-600/10 rounded-xl border border-green-200/30 dark:border-green-700/20">
              <p className="text-sm text-slate-500 dark:text-slate-400">Disbursed This Month</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{formatCurrency(stats?.monthly.disbursed || 0, DEFAULT_ADMIN_CURRENCY)}</p>
              <p className="text-xs text-slate-400 mt-1">{stats?.monthly.advance_count || 0} advances</p>
            </div>
            <div className="p-4 bg-linear-to-br from-green-500/5 to-green-600/5 dark:from-green-500/10 dark:to-green-600/10 rounded-xl border border-green-200/30">
              <p className="text-sm text-slate-500 dark:text-slate-400">Platform Fees</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(stats?.monthly.fees || 0, DEFAULT_ADMIN_CURRENCY)}</p>
              <p className="text-xs text-slate-400 mt-1">Revenue this month</p>
            </div>
            <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
              <p className="text-sm text-slate-500 dark:text-slate-400">Avg. Employer Risk</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{avgEmployerRisk.toFixed(1)}</p>
              <p className="text-xs text-slate-400 mt-1">{avgEmployerRisk >= 4 ? 'Low Risk' : avgEmployerRisk >= 3 ? 'Medium Risk' : 'High Risk'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <GradientIconBox icon={Bell} size="sm" variant="green" />
              <h2 className="font-bold text-slate-900 dark:text-white">Notifications</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                {notifications.filter(n => !n.read).length} New
              </span>
            </div>
          </div>
          <NotificationCenter notifications={notifications} />
          <Link href="/admin/notifications" className="inline-flex items-center gap-1 text-sm text-green-600 mt-4 hover:gap-2 transition-all">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { link: '/admin/employers?status=pending', icon: CheckCircle2, label: 'Verify Employers', count: stats?.kyc_pending.employers || 0, variant: 'slate' as const },
          { link: '/admin/kyc-review', icon: FileText, label: 'Review KYC', count: stats?.kyc_pending.employees || 0, variant: 'slate' as const },
          { link: '/admin/risk-scoring', icon: Shield, label: 'Risk Scoring', count: stats?.pending_reviews ?? null, variant: 'green' as const },
          { link: '/admin/reconciliation', icon: BarChart3, label: 'Reconciliation', count: stats?.pending_reconciliation ?? null, variant: 'green' as const },
        ].map((item, i) => (
          <Link key={i} href={item.link} className="group">
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30 hover:border-green-300 dark:hover:border-green-600/30 transition-all hover:shadow-lg hover:shadow-green-500/10">
              <div className="flex items-center gap-3">
                <GradientIconBox icon={item.icon} size="sm" variant={item.variant} />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.count !== null ? `${item.count} ${item.count === 1 ? 'pending' : 'pending'}` : 'View & manage'}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
