"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users, TrendingUp, ArrowRight, CreditCard, Building2, Upload,
  BarChart3, AlertCircle, CheckCircle2, ArrowUpRight, ArrowDownRight,
  ChevronRight, Wallet, Calendar, DollarSign, Activity, Clock,
  FileText, Zap, Landmark, Copy, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmployerPortalLayout } from '@/components/employer/EmployerLayout';
import { formatCurrency, cn } from '@/lib/utils';
import { GradientIconBox } from '@/components/employer/SharedComponents';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/auth';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';

interface EmployerProfile {
  id: string;
  company_name: string;
  company_code: string;
  status: string;
  industry: string | null;
  payroll_cycle: string | null;
  risk_score: number | null;
  risk_rating: string | null;
  contact_person: string | null;
  currency: string;
  reviewer_notes: string;
}

interface PeriodData {
  advances: {
    total: number; disbursed: number; pending: number; rejected: number;
    total_amount: number; total_fees: number; avg_amount: number;
    by_method: { mobile_money: number; bank_transfer: number };
  };
  employees: { total: number; active: number; with_advances: number; utilization_rate: number };
  monthly_trend: Array<{ label: string; amount: number; count: number }>;
  last_sync?: {
    status: 'success' | 'failed' | 'partial';
    records_received: number;
    records_valid: number;
    created_at: string;
  } | null;
}

interface CreditSummary {
  month: string;
  company_credit_limit: number;
  total_outstanding_credit: number;
  month_disbursed_amount: number;
  remaining_monthly_limit: number;
  available_company_credit: number;
  utilization_percent: number;
}

interface EmployeeStats {
  total_employees: number;
  active_employees: number;
  kyc_completion_rate: number;
  retention_rate: number;
  avg_tenure_months: number;
  new_hires_30_days: number;
  department_breakdown?: Record<string, number>;
}

function computeTrend(
  current: number,
  previous: number,
): { label: string; trendUp: boolean } | undefined {
  if (previous === 0 && current === 0) return undefined;
  if (previous === 0) return { label: '▲ New', trendUp: true };
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? '+' : '';
  return { label: `${sign}${pct.toFixed(1)}%`, trendUp: pct >= 0 };
}

const AnimatedCounter = ({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) => {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const dur = 1200;
    const animate = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * ease));
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);
  return <span>{prefix}{display.toLocaleString()}{suffix}</span>;
};

const MainStatsCard = ({ employer, employeeStats }: { employer: EmployerProfile | null; employeeStats: EmployeeStats | null }) => {
  const total  = employeeStats?.total_employees  ?? 0;
  const active = employeeStats?.active_employees ?? 0;
  const pct    = total > 0 ? Math.round((active / total) * 100) : 0;
  const circ   = 2 * Math.PI * 44;
  const offset = circ - (pct / 100) * circ;

  const statusConfig: Record<string, { label: string; color: string }> = {
    approved: { label: 'Verified',       color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' },
    rejected: { label: 'Rejected',       color: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300' },
    suspended: { label: 'Suspended',     color: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300' },
    risk_review_in_progress: { label: 'Review Pending', color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' },
    submitted: { label: 'In Review',     color: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' },
    pending: { label: 'Action Needed', color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' },
  };

  const status = statusConfig[employer?.status || ''] || { label: employer?.status || 'Not Started', color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' };

  return (
    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-slate-200/50 dark:border-slate-700/30">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Company Overview</h2>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{employer?.company_name ?? '—'}</p>
        </div>
        <div className={cn("px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider", status.color)}>
          {status.label}
        </div>
      </div>

      <div className="relative w-40 h-40 mx-auto mb-6">
        <div className="absolute inset-2 rounded-full bg-primary/10 blur-xl" />
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6"
            className="text-slate-200 dark:text-slate-800/60" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="url(#empGrad)" strokeWidth="6"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out" />
          <defs>
            <linearGradient id="empGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0df259" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-slate-900 dark:text-white">
            <AnimatedCounter value={total} />
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Employees</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-8">
        <div className="text-center">
          <span className="text-2xl font-bold text-primary">{active}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">Active</span>
        </div>
        <div className="w-px h-10 bg-slate-200 dark:bg-slate-700" />
        <div className="text-center">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">{pct}%</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">Utilization</span>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, subtext, trend }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; subtext?: string; trend?: { label: string; trendUp: boolean }; }) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30 hover:shadow-lg transition-all duration-300 group">
    <div className="flex items-start justify-between mb-3">
      <GradientIconBox icon={Icon} size="md" />
      {trend && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
          trend.trendUp
            ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            : "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
        )}>
          {trend.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend.label}
        </div>
      )}
    </div>
    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
    {subtext && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtext}</p>}
  </div>
);

const QuickActionCard = ({ icon: Icon, title, description, href }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; href: string }) => (
  <Link href={href} className="block group">
    <div className="relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/30">
      <div className="relative z-10">
        <GradientIconBox icon={Icon} size="lg" className="mb-4 group-hover:scale-110 transition-transform duration-300" />
        <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-all mt-3" />
      </div>
    </div>
  </Link>
);

const StatusItem = ({ icon: Icon, label, value, status }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; status: 'success' | 'warning' | 'default' }) => (
  <div className="flex items-center gap-4 p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
    <div className={cn(
      "w-10 h-10 rounded-xl flex items-center justify-center shadow-md",
      status === 'success' ? 'bg-linear-to-br from-emerald-500 to-emerald-600' :
      status === 'warning' ? 'bg-linear-to-br from-amber-500 to-amber-600' :
      'bg-linear-to-br from-primary to-emerald-600'
    )}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div className="flex-1">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  </div>
);

const MiniStatRow = ({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
    <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
    <span className={cn("text-sm font-semibold", accent ? "text-primary" : "text-slate-900 dark:text-white")}>{value}</span>
  </div>
);

const Sparkline = ({ trend, currency = 'KES' }: { trend: Array<{ label: string; amount: number }>; currency?: string }) => {
  const max = Math.max(...trend.map(t => t.amount), 1);
  return (
    <div className="flex items-end gap-1 h-12">
      {trend.map((t, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full rounded-t-sm bg-linear-to-t from-primary/60 to-primary transition-all duration-700"
            style={{ height: `${Math.max((t.amount / max) * 40, t.amount > 0 ? 3 : 1)}px` }}
            title={`${t.label}: ${formatCurrency(t.amount, currency)}`}
          />
        </div>
      ))}
    </div>
  );
};

const PayrollHealthCard = ({ lastSync }: { lastSync: PeriodData['last_sync'] }) => {
  const statusConfig = {
    success: { label: 'Healthy', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    failed: { label: 'Out of Sync', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-500/10' },
    partial: { label: 'Issues Found', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-500/10' },
  };

  const status = lastSync ? statusConfig[lastSync.status] || { label: lastSync.status, icon: Activity, color: 'text-slate-400', bg: 'bg-slate-100' } : { label: 'No Data', icon: Activity, color: 'text-slate-400', bg: 'bg-slate-100' };
  const Icon = status.icon;

  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GradientIconBox icon={FileText} size="md" />
          <h2 className="font-bold text-slate-900 dark:text-white">Payroll Health</h2>
        </div>
        <div className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border", status.bg, status.color)}>
          <Icon className="w-3 h-3" />
          {status.label}
        </div>
      </div>

      {lastSync ? (
        <div className="space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Records</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{lastSync.records_received}</p>
            </div>
            <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Valid</p>
              <p className="text-lg font-bold text-emerald-600">{lastSync.records_valid}</p>
            </div>
          </div>
          
          <div className="pt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Last synced {new Date(lastSync.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
            <Activity className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">No payroll data synced yet</p>
        </div>
      )}

      <Link href="/dashboards/employer-dashboard/payroll" className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 group">
        <span className="text-xs font-semibold text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
          View Sync Logs <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </Link>
    </div>
  );
};

const ReferralCodeCard = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(() => {
    if (typeof window === 'undefined') return;
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div className="bg-linear-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 backdrop-blur-sm rounded-2xl p-6 border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <GradientIconBox icon={Zap} size="md" />
          <h2 className="font-bold text-slate-900 dark:text-white">Employee Onboarding</h2>
        </div>
        <div className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          Referral Code
        </div>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
        Share this unique code with your employees. They&apos;ll use it during registration to link their accounts to your company.
      </p>
      
      <div className="group relative">
        <div className="absolute -inset-1 bg-linear-to-r from-indigo-500 to-purple-500 rounded-xl blur-sm opacity-25 group-hover:opacity-50 transition duration-300" />
        <div className="relative flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-inner">
          <div className="flex-1 font-mono font-bold text-xl text-center py-2 tracking-widest text-indigo-600 dark:text-indigo-400 select-all">
            {code}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0"
            onClick={copyToClipboard}
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
          </Button>
        </div>
      </div>
      
      <div className="mt-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic text-center leading-tight">
          &quot;Share this code to get your team started on EaziWage today!&quot;
        </p>
      </div>
    </div>
  );
};

interface DashboardData {
  employer: EmployerProfile | null;
  curr: PeriodData | null;
  prev: PeriodData | null;
  credit: CreditSummary | null;
  employeeStats: EmployeeStats | null;
  loading: boolean;
  error: string | null;
}

export default function EmployerDashboard() {
  const { currency } = useCurrency();
  const user = useAuthStore((state) => state.user);
  const [data, setData] = useState<DashboardData>({
    employer: null,
    curr: null,
    prev: null,
    credit: null,
    employeeStats: null,
    loading: true,
    error: null,
  });
  
  const router = useRouter();

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setData(prev => ({ ...prev, loading: true, error: null }));
    try {
      const profRes = await fetch('/api/employer-dashboard/profile');
      if (profRes.status === 404) {
        setData(prev => ({ ...prev, loading: false, error: 'profile_not_found' }));
        return;
      }
      if (!profRes.ok) throw new Error(`profile ${profRes.status}`);
      const profJson = await profRes.json();
      const profile: EmployerProfile = profJson.profile;

      const incomplete = !profile.company_name || String(profile.status).toLowerCase() === 'draft';
      if (incomplete) {
        router.replace('/dashboards/employer-dashboard/onboarding');
        return;
      }

      const [currRes, prevRes, creditRes, employeeRes] = await Promise.all([
        fetch('/api/employer-dashboard/reports?period=this_month'),
        fetch('/api/employer-dashboard/reports?period=last_month'),
        fetch('/api/employer-dashboard/credit'),
        fetch('/api/employer-dashboard/employees'),
      ]);

      const updates: Partial<DashboardData> = {
        employer: profile,
        loading: false
      };

      if (currRes.ok) {
        const j = await currRes.json();
        if (j.data) updates.curr = j.data;
      }
      if (prevRes.ok) {
        const j = await prevRes.json();
        if (j.data) updates.prev = j.data;
      }
      if (creditRes.ok) {
        const j = await creditRes.json();
        updates.credit = j;
      }
      if (employeeRes.ok) {
        const j = await employeeRes.json();
        if (j.stats) updates.employeeStats = j.stats;
      }

      setData(prev => ({ ...prev, ...updates }));
    } catch {
      setData(prev => ({ ...prev, loading: false, error: 'Failed to load dashboard.' }));
    }
  }, [router]);

  useEffect(() => {
    // Calling load once on mount is safe. 
    // The previous implementation had a comment about synchronous setState in useEffect,
    // which usually refers to calling setState immediately after mount.
    // By consolidating state, we reduce the number of updates.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load({ silent: true });
  }, [load]);

  useEffect(() => {
    if (!user?.id || !data.employer?.id) return;

    const supabase = createClient();

    const handleUpdate = () => {
      console.log('[Realtime] Employer overview update');
      void load();
    };

    const userChannel = (supabase as any)
      .channel(`realtime:kyc:user-${user.id}`)
      .on('postgres_changes' as any, { event: 'UPDATE', schema: 'public', table: 'employee_onboarding', filter: `user_id=eq.${user.id}` }, () => {
        handleUpdate();
      })
      .subscribe();

    const employerChannel = (supabase as any)
      .channel(`realtime:kyc:employer-${data.employer.id}`)
      .on('postgres_changes' as any, { event: 'UPDATE', schema: 'public', table: 'employee_onboarding', filter: `employer_id=eq.${data.employer.id}` }, () => {
        handleUpdate();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(userChannel);
      supabase.removeChannel(employerChannel);
    };
  }, [user?.id, data.employer?.id, load]);

  const disbursedTrend   = computeTrend(data.curr?.advances.total_amount ?? 0, data.prev?.advances.total_amount ?? 0);
  const feesTrend        = computeTrend(data.curr?.advances.total_fees   ?? 0, data.prev?.advances.total_fees   ?? 0);
  const avgAdvanceTrend  = computeTrend(data.curr?.advances.avg_amount   ?? 0, data.prev?.advances.avg_amount   ?? 0);
  const utilizationTrend = computeTrend(data.curr?.employees.utilization_rate ?? 0, data.prev?.employees.utilization_rate ?? 0);

  if (data.loading) {
    return (
      <EmployerPortalLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-14 h-14 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </EmployerPortalLayout>
    );
  }

  if (data.error === 'profile_not_found') {
    return (
      <EmployerPortalLayout>
        <div className="max-w-lg mx-auto py-16 text-center">
          <div className="w-24 h-24 bg-linear-to-br from-primary/20 to-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Building2 className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Complete Your Company Profile</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">
            Set up your company profile to start offering EaziWage to your employees and unlock all features.
          </p>
          <Link href="/dashboards/employer-dashboard/onboarding">
            <Button className="h-12 px-8 bg-linear-to-r from-primary to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-shadow">
              Complete Setup <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </EmployerPortalLayout>
    );
  }

  const isPending = data.employer?.status === 'pending' || data.employer?.status === 'submitted' || data.employer?.status === 'risk_review_in_progress';

  return (
    <EmployerPortalLayout employer={data.employer}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Rejection Recovery Alert */}
        {data.employer?.status === 'rejected' && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-500 shadow-lg shadow-red-500/5">
            <div className="flex items-start gap-4 text-left">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-2xl flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-900 dark:text-red-200 uppercase tracking-tight">Application Rejected</h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Your company verification was not approved. Reason: {data.employer?.reviewer_notes || "Please review your business details and re-submit for approval."}
                </p>
              </div>
            </div>
            <Link href="/dashboards/employer-dashboard/onboarding" className="w-full md:w-auto">
              <Button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest rounded-2xl px-8 h-12 shadow-lg shadow-red-600/20 transition-all">
                Update Now <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}

        {isPending && (
          <div className="bg-linear-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4 border border-amber-500/20">
            <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                {data.employer?.status === 'risk_review_in_progress' ? 'Risk Review in Progress' : 'Verification in Progress'}
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300/80 mt-0.5">
                {data.employer?.status === 'risk_review_in_progress' 
                  ? 'Our compliance team is currently assessing your company risk profile. This usually takes 1–2 business days.'
                  : 'Your company profile is being reviewed. This usually takes 1–2 business days.'}
              </p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <MainStatsCard employer={data.employer} employeeStats={data.employeeStats} />

          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
            <MetricCard
              icon={DollarSign}
              label="Disbursed This Month"
              value={formatCurrency(data.curr?.advances.total_amount ?? 0, currency)}
              subtext="vs last month"
              trend={disbursedTrend}
            />
            <MetricCard
              icon={Wallet}
              label="Fees Collected"
              value={formatCurrency(data.curr?.advances.total_fees ?? 0, currency)}
              subtext="vs last month"
              trend={feesTrend}
            />
            <MetricCard
              icon={Activity}
              label="Avg. Advance"
              value={formatCurrency(data.curr?.advances.avg_amount ?? 0, currency)}
              subtext="per disbursement"
              trend={avgAdvanceTrend}
            />
            <MetricCard
              icon={TrendingUp}
              label="Utilization Rate"
              value={`${data.curr?.employees.utilization_rate ?? 0}%`}
              subtext="employees using advances"
              trend={utilizationTrend}
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <GradientIconBox icon={CreditCard} size="md" />
                <h2 className="font-bold text-slate-900 dark:text-white">Advances</h2>
              </div>
              <Link href="/dashboards/employer-dashboard/advances" className="text-xs font-medium text-primary flex items-center gap-1 hover:gap-1.5 transition-all">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <MiniStatRow label="Total requests"  value={data.curr?.advances.total    ?? 0} />
            <MiniStatRow label="Disbursed"        value={data.curr?.advances.disbursed ?? 0} accent />
            <MiniStatRow label="Pending"          value={data.curr?.advances.pending   ?? 0} />
            <MiniStatRow label="Rejected"         value={data.curr?.advances.rejected  ?? 0} />
            <MiniStatRow label="Mobile Money"     value={data.curr?.advances.by_method.mobile_money  ?? 0} />
            <MiniStatRow label="Bank Transfer"    value={data.curr?.advances.by_method.bank_transfer ?? 0} />
          </div>

          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <GradientIconBox icon={Users} size="md" />
                <h2 className="font-bold text-slate-900 dark:text-white">Employees</h2>
              </div>
              <Link href="/dashboards/employer-dashboard/employees" className="text-xs font-medium text-primary flex items-center gap-1 hover:gap-1.5 transition-all">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <MiniStatRow label="Total enrolled"     value={data.employeeStats?.total_employees ?? data.curr?.employees.total ?? 0} />
            <MiniStatRow label="Active"              value={data.employeeStats?.active_employees ?? data.curr?.employees.active ?? 0} accent />
            <MiniStatRow label="Used advances"       value={data.curr?.employees.with_advances  ?? 0} />
            <MiniStatRow label="Utilization rate"   value={`${data.curr?.employees.utilization_rate ?? 0}%`} accent />

            {data.curr?.monthly_trend && data.curr.monthly_trend.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-400 mb-2">Monthly disbursements (6 mo.)</p>
                <Sparkline trend={data.curr.monthly_trend} currency={currency} />
              </div>
            )}
          </div>

          <PayrollHealthCard lastSync={data.curr?.last_sync} />
        </div>

        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <GradientIconBox icon={Landmark} size="md" />
              <h2 className="font-bold text-slate-900 dark:text-white">Company-Wide Credit</h2>
            </div>
            <Link href="/dashboards/employer-dashboard/reports" className="text-xs font-medium text-primary flex items-center gap-1 hover:gap-1.5 transition-all">
              Export Reports <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={Landmark}
              label="Credit Limit"
              value={formatCurrency(data.credit?.company_credit_limit ?? 0, currency)}
              subtext="Configured monthly cap"
            />
            <MetricCard
              icon={CreditCard}
              label="Outstanding Credit"
              value={formatCurrency(data.credit?.total_outstanding_credit ?? 0, currency)}
              subtext="Currently exposed company-wide"
            />
            <MetricCard
              icon={Zap}
              label="Month Used"
              value={formatCurrency(data.credit?.month_disbursed_amount ?? 0, currency)}
              subtext={`${data.credit?.utilization_percent ?? 0}% of monthly limit`}
            />
            <MetricCard
              icon={Wallet}
              label="Remaining EWA Limit"
              value={formatCurrency(data.credit?.remaining_monthly_limit ?? 0, currency)}
              subtext={`Month: ${data.credit?.month ?? 'N/A'}`}
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
             <ReferralCodeCard code={data.employer?.company_code || '---'} />
          </div>
          
          <div className="lg:col-span-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Quick Actions</h2>
              <Link href="/dashboards/employer-dashboard/payroll" className="text-sm font-medium text-primary flex items-center gap-1 hover:gap-2 transition-all">
                Upload Payroll <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <QuickActionCard icon={Users}    title="Manage Employees" description="Add, edit, or view profiles"   href="/dashboards/employer-dashboard/employees" />
              <QuickActionCard icon={Upload}   title="Upload Payroll"   description="Update earnings data"          href="/dashboards/employer-dashboard/payroll" />
              <QuickActionCard icon={CreditCard} title="View Advances"  description="Track wage advances"           href="/dashboards/employer-dashboard/advances" />
              <QuickActionCard icon={BarChart3} title="Reports"         description="Analytics and insights"        href="/dashboards/employer-dashboard/reports" />
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-5">Company Status</h2>
            <div className="space-y-3">
              <StatusItem
                icon={CheckCircle2}
                label="Verification Status"
                value={data.employer?.status === 'approved' ? 'Fully Verified' : 'Under Review'}
                status={data.employer?.status === 'approved' ? 'success' : 'warning'}
              />
              <StatusItem
                icon={Building2}
                label="Industry"
                value={data.employer?.industry?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Not Set'}
                status="default"
              />
              <StatusItem
                icon={Calendar}
                label="Payroll Cycle"
                value={data.employer?.payroll_cycle
                  ? data.employer.payroll_cycle.charAt(0).toUpperCase() + data.employer.payroll_cycle.slice(1)
                  : 'Monthly'}
                status="default"
              />
              <StatusItem
                icon={Clock}
                label="Risk Rating"
                value={data.employer?.status === 'risk_review_in_progress' || (data.employer?.risk_score === 0) 
                  ? 'Risk review in progress' 
                  : data.employer?.risk_rating ? `Rating ${data.employer.risk_rating}` : 'Not Rated Yet'}
                status={data.employer?.risk_rating === 'A' ? 'success' : (data.employer?.status === 'risk_review_in_progress' || data.employer?.risk_score === 0) ? 'warning' : data.employer?.risk_rating === 'D' ? 'warning' : 'default'}
              />
            </div>
          </div>

          <div className="bg-linear-to-br from-primary/5 to-emerald-500/5 dark:from-primary/10 dark:to-emerald-500/10 backdrop-blur-sm rounded-2xl p-6 border border-primary/10 dark:border-primary/20">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Risk Assessment</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Your company&apos;s risk profile</p>
              </div>
              {(() => {
                if (data.employer?.status === 'risk_review_in_progress' || data.employer?.risk_score === 0) {
                    return <div className="px-4 py-2 rounded-xl font-semibold text-sm bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">Review in Progress</div>;
                }
                const rs = data.employer?.risk_score ?? 3.5;
                const label = rs >= 4 ? 'Low Risk' : rs >= 3 ? 'Medium Risk' : rs >= 2.6 ? 'High Risk' : 'Very High Risk';
                const cls   = rs >= 4
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : rs >= 3
                  ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                  : rs >= 2.6
                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300';
                return <div className={cn("px-4 py-2 rounded-xl font-semibold text-sm", cls)}>{label}</div>;
              })()}
            </div>

            <div className="flex items-center gap-6">
              <div className="relative w-24 h-24 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8"
                    className="text-white/50 dark:text-slate-700/50" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="url(#riskGrad)" strokeWidth="8"
                    strokeLinecap="round" strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - ((data.employer?.risk_score ?? (data.employer?.status === 'risk_review_in_progress' ? 0 : 3.5)) / 5))}
                    className="transition-all duration-1000" />
                  <defs>
                    <linearGradient id="riskGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#0df259" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {(data.employer?.risk_score ?? (data.employer?.status === 'risk_review_in_progress' ? 0 : 3.5)).toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {data.employer?.status === 'risk_review_in_progress' || data.employer?.risk_score === 0
                    ? 'Your risk profile is currently being assessed by our team. You will be notified once the review is complete.'
                    : 'Your risk score determines the fee rates applied to employee advances. A higher score means better rates.'}
                </p>
                <Link href="/dashboards/employer-dashboard/risk-insights" className="inline-flex items-center gap-1 text-sm font-medium text-primary mt-3 hover:gap-2 transition-all">
                  View Details <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>

      </div>
    </EmployerPortalLayout>
  );
}
