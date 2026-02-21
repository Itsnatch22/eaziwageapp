//@ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Building2, Users, CreditCard, Shield, Clock, CheckCircle2,
  AlertTriangle, TrendingUp, ArrowRight, FileText, Wifi, Activity,
  DollarSign, BarChart3,
} from 'lucide-react';
import { Button }            from '@/components/ui/button';
import { AdminPortalLayout } from '@/components/admin/AdminLayout';
import { formatCurrency, cn } from '@/lib/utils';

// Types
type VariantColor = 'green' | 'slate' | 'black';
type APIStatus = 'healthy' | 'degraded' | 'down';

interface DashboardStats {
  employers: { total: number; active: number };
  employees: { total: number; active: number };
  advances: { total_count: number; pending_count: number; total_disbursed: number; total_fees: number };
  kyc_pending: { employers: number; employees: number };
  pending_reviews: number;
  monthly: { disbursed: number; advance_count: number; fees: number };
  risk: { avg_employer_score: number };
  api_health: Record<string, { status: APIStatus; latency_ms: number; uptime_percent: number }>;
}

// Components
const GradientIconBox = ({ icon: Icon, size = 'md', variant = 'green' as VariantColor }) => {
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

const MetricCard = ({ icon, label, value, subtext, trend, trendUp, variant = 'green' as VariantColor }) => (
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
  icon: any; title: string; count: number; description: string; link: string; variant: 'green'|'slate'|'black';
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
        <Button variant="ghost" size="sm" className={iconColors[variant]}>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  );
};

const APIHealthCard = ({ api }: { api: { name: string; status: APIStatus; latency_ms: number; uptime_percent: number } }) => {
  const statusColors = { healthy: 'bg-green-500', degraded: 'bg-slate-500', down: 'bg-slate-600' };
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
      <div className="flex items-center gap-3">
        <div className={cn('w-2.5 h-2.5 rounded-full', statusColors[api.status], api.status === 'healthy' && 'animate-pulse')} />
        <p className="text-sm font-medium text-slate-900 dark:text-white">{api.name}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-slate-900 dark:text-white">{api.latency_ms}ms</p>
        <p className="text-xs text-slate-500">{api.uptime_percent}% uptime</p>
      </div>
    </div>
  );
};

// Main
export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/dashboard');
        if (res.ok) setStats(await res.json());
      } catch (err) {
        console.error('[AdminDashboard] fetch failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard Overview</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Platform-wide metrics and operations</p>
          </div>
          <Button variant="outline" className="bg-white/60 dark:bg-slate-800/60">
            <BarChart3 className="w-4 h-4 mr-2" /> Reports
          </Button>
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

        {/* Metrics */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={Building2} label="Total Employers" value={stats?.employers.total || 0} subtext={`${stats?.employers.active || 0} active`} trend="+12%" trendUp variant="green" />
          <MetricCard icon={Users} label="Total Employees" value={stats?.employees.total || 0} subtext={`${stats?.employees.active || 0} active`} trend="+18%" trendUp variant="slate" />
          <MetricCard icon={CreditCard} label="Total Advances" value={stats?.advances.total_count || 0} subtext={`${stats?.advances.pending_count || 0} pending`} variant="green" />
          <MetricCard icon={DollarSign} label="Total Disbursed" value={formatCurrency(stats?.advances.total_disbursed || 0)} subtext={`Fees: ${formatCurrency(stats?.advances.total_fees || 0)}`} variant="slate" />
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
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{formatCurrency(stats?.monthly.disbursed || 0)}</p>
                <p className="text-xs text-slate-400 mt-1">{stats?.monthly.advance_count || 0} advances</p>
              </div>
              <div className="p-4 bg-linear-to-br from-green-500/5 to-green-600/5 dark:from-green-500/10 dark:to-green-600/10 rounded-xl border border-green-200/30">
                <p className="text-sm text-slate-500 dark:text-slate-400">Platform Fees</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(stats?.monthly.fees || 0)}</p>
                <p className="text-xs text-slate-400 mt-1">Revenue this month</p>
              </div>
              <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                <p className="text-sm text-slate-500 dark:text-slate-400">Avg. Employer Risk</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats?.risk.avg_employer_score.toFixed(1) || '3.5'}</p>
                <p className="text-xs text-slate-400 mt-1">{stats?.risk.avg_employer_score >= 4 ? 'Low Risk' : stats?.risk.avg_employer_score >= 3 ? 'Medium Risk' : 'High Risk'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <GradientIconBox icon={Wifi} size="sm" variant="green" />
                <h2 className="font-bold text-slate-900 dark:text-white">API Health</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-green-600 dark:text-green-400">All Systems Operational</span>
              </div>
            </div>
            <div className="space-y-2">
              {stats?.api_health && Object.entries(stats.api_health).map(([key, api]) => (
                <APIHealthCard key={key} api={{ ...api, name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }} />
              ))}
            </div>
            <Link href="/admin/api-health" className="inline-flex items-center gap-1 text-sm text-green-600 mt-4 hover:gap-2 transition-all">
              View Details <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { link: '/admin/employers?status=pending', icon: CheckCircle2, label: 'Verify Employers', count: stats?.kyc_pending.employers || 0, variant: 'slate' as const },
            { link: '/admin/kyc-review', icon: FileText, label: 'Review KYC', count: stats?.kyc_pending.employees || 0, variant: 'slate' as const },
            { link: '/admin/risk-scoring', icon: Shield, label: 'Risk Scoring', count: null, variant: 'green' as const },
            { link: '/admin/reconciliation', icon: BarChart3, label: 'Reconciliation', count: null, variant: 'green' as const },
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
    </AdminPortalLayout>
  );
}