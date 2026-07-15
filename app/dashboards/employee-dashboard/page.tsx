"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Wallet, TrendingUp, ArrowRight,
  CheckCircle2, History, Calendar,
  Building2, Zap, ChevronRight,
  Shield, Landmark,
  ArrowDownLeft, ArrowUpRight as ArrowUpRightIcon, AlertCircle, Sparkles,
  Calculator,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, cn, calculateFeePercentage } from '@/lib/utils';
import { EmployeePortalLayout } from '@/components/employee/EmployeeLayout';
import { useAuthStore } from '@/lib/stores/auth';
import { useCurrency } from '@/hooks/useCurrency';
import { UserOnboardingGuide } from '@/components/onboarding-guide/UserOnboardingGuide';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { createClient } from '@/lib/supabase/client';
import { notifyEligibleMoment } from '@/lib/stores/satisfaction-prompt-trigger';
import { StatTilesSkeleton } from '@/components/shared/Skeletons';



interface RecentTransaction {
  id: string | number;
  type: string;
  amount: number;
  created_at: string;
  status: string;
}

interface DashboardStats {
  earned_wages?: number;
  advance_limit?: number;
  total_advances?: number;
  recent_transactions?: RecentTransaction[];
}

interface EmployeeSummary {
  full_name?: string;
  profile_picture_url?: string;
  employer_name?: string;
  job_title?: string;
  status?: string;
  kyc_status?: string;
  currency?: string;
  reviewer_notes: string;
  employer_id?: string;
  risk_score?: number;
  created_at?: string;
}



const SpeedDial = ({ 
  value, 
  max, 
  currency = 'KES', 
  isMonthlyProgress = false 
}: { 
  value?: number; 
  max?: number; 
  currency?: string; 
  isMonthlyProgress?: boolean 
}) => {
  let pct = 0;
  let displayValue = '';
  let subtitle = '';
  let badge = '';
  let monthlyInfo = '';
  
  if (isMonthlyProgress) {

    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthlyPct = Math.min((currentDay / daysInMonth) * 100, 100);
    

    pct = monthlyPct;
    displayValue = formatCurrency(value || 0, currency).split('.')[0];
    subtitle = 'Accrued This Month';
    badge = 'Available Now';
    monthlyInfo = `Day ${currentDay} of ${daysInMonth} (${Math.round(monthlyPct)}%)`;
  } else {

    pct = max && max > 0 ? Math.min((value || 0) / max * 100, 100) : 0;
    displayValue = formatCurrency(value || 0, currency).split('.')[0];
    subtitle = 'Unlocked Funds';
    badge = 'Available Now';
    monthlyInfo = '';
  }
  
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="relative w-56 h-56 mx-auto">
      <div className="absolute inset-4 rounded-full blur-2xl opacity-10"
        style={{ background: 'radial-gradient(circle, #10b981, transparent)' }} />

      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="3"
          className="text-slate-100 dark:text-white/5" />
        <circle cx="50" cy="50" r={r} fill="none"
          stroke="url(#dialGrad)" strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-[1.5s] ease-out" />
        <defs>
          <linearGradient id="dialGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0df259" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400 mb-1">{subtitle}</p>
        <p className="text-4xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
          {displayValue}
        </p>
        <div className="mt-2 px-3 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
          style={{ background: '#10b98115', border: '1px solid #10b98125' }}>
          {badge}
        </div>
        {monthlyInfo && (
          <p className="mt-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            {monthlyInfo}
          </p>
        )}
      </div>
    </div>
  );
};

const STAT_ACCENTS: Record<string, string> = {
  emerald: '#10b981',
  blue: '#3b82f6',
  amber: '#f59e0b',
  purple: '#8b5cf6',
};

const StatBlock = ({ icon: Icon, label, value, sub, variant = 'blue' }: {
  icon: React.ElementType; label: string; value: React.ReactNode; sub?: string; variant?: string;
}) => {
  const accent = STAT_ACCENTS[variant] ?? '#3b82f6';
  return (
    <div className="relative bg-white/50 dark:bg-white/4 backdrop-blur-xl rounded-2xl p-5 border border-white/60 dark:border-white/10 overflow-hidden group transition-all duration-300 hover:border-white/80 dark:hover:border-white/20">
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-15 group-hover:opacity-25 transition-opacity"
        style={{ background: accent }} />
      <div className="relative z-10">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
          style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{value}</h3>
        {sub && <p className="text-[10px] text-slate-400/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};



export default function EmployeeDashboardPage() {
  const { currency } = useCurrency();
  const user = useAuthStore((state) => state.user);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveEmployeeId, setLiveEmployeeId] = useState<string | null>(null);
  const router = useRouter();


  const fetchStats = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const res = await fetch('/api/employee-dashboard/overview');
      const data = await res.json();
      if (!res.ok) {
        setError(res.status === 404 ? 'profile_not_found' : data?.message || 'Error');
        return;
      }
      setStats(data.stats);
      setEmployee(data.employee);
      
    } catch {
      setError('Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStats({ silent: true });
  }, [fetchStats]);

  // Resolve the live employees.id for the advances/EWA realtime filters below —
  // those tables key on employees.id, not the auth user id. employee_onboarding
  // is the exception: it genuinely has a user_id column.
  useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();
    supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setLiveEmployeeId(data?.id ?? null));
  }, [user?.id]);

  // Refresh dashboard when any relevant record changes — advance status, EWA
  // settings, or KYC status.
  useRealtimeRefresh(
    [
      ...(liveEmployeeId ? [
        { table: 'advances',              filter: `employee_id=eq.${liveEmployeeId}` },
        { table: 'employee_ewa_settings', filter: `employee_id=eq.${liveEmployeeId}` },
      ] : []),
      ...(user?.id ? [
        { table: 'employee_onboarding', filter: `user_id=eq.${user.id}` },
      ] : []),
    ],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_table) => void fetchStats({ silent: true }),
  );

  // CSAT: prompt once KYC is fully approved and the account has been active
  // for at least 3 days (no dedicated approved_at column exists, so
  // employee_onboarding.created_at is used as the onboarding-start proxy).
  // Safe to call on every render this stays true — the hook debounces
  // repeat status checks and the server-side eligibility check is the real
  // gate, so there's no need for edge-detection here.
  useEffect(() => {
    const verified = employee?.kyc_status === 'approved' && employee?.status === 'approved';
    const activeLongEnough = employee?.created_at
      ? Date.now() - new Date(employee.created_at).getTime() >= 3 * 24 * 60 * 60 * 1000
      : false;
    if (verified && activeLongEnough) {
      notifyEligibleMoment('employee_kyc_verified_3d');
    }
  }, [employee?.kyc_status, employee?.status, employee?.created_at]);

  const getNextPayday = () => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysUntil = Math.ceil((lastDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { date: lastDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), daysUntil };
  };


  if (loading) return (
    <EmployeePortalLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <StatTilesSkeleton count={4} />
      </div>
    </EmployeePortalLayout>
  );


  if (error === 'profile_not_found') return (
    <EmployeePortalLayout>
      <div className="max-w-sm mx-auto text-center py-16 space-y-8">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto"
          style={{ background: '#10b98112', border: '1px solid #10b98125' }}>
          <Sparkles className="w-9 h-9 text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Setup Required</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Your employee profile isn&apos;t fully configured yet. Let&apos;s get you started.
          </p>
        </div>
        <Button
          onClick={() => router.push('/dashboards/employee-dashboard/onboarding')}
          className="h-12 px-8 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 w-full"
        >
          Start Onboarding <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </EmployeePortalLayout>
  );

  const earnedWages = stats?.earned_wages || 0;
  const advanceLimit = stats?.advance_limit || 0;
  const totalAdvances = stats?.total_advances || 0;
  const kycPending = employee?.kyc_status === 'pending' || employee?.kyc_status === 'submitted';
  const isVerified = employee?.kyc_status === 'approved' && employee?.status === 'approved';
  const payday = getNextPayday();

  return (
    <EmployeePortalLayout>
      <UserOnboardingGuide role="employee" show={isVerified} />
      <div className="max-w-5xl mx-auto space-y-6">

        
        {employee?.kyc_status === 'rejected' && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-start gap-4 text-left">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-2xl flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-900 dark:text-red-200 uppercase tracking-tight">Verification Rejected</h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Your identity documents were not approved. Reason: {employee?.reviewer_notes || "Please review the requirements and re-upload."}
                </p>
              </div>
            </div>
            <Link href="/dashboards/employee-dashboard/onboarding" className="w-full md:w-auto">
              <Button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest rounded-2xl px-8 h-12 shadow-lg shadow-red-600/20 transition-all">
                Fix Now <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}

        
        <div className="grid lg:grid-cols-12 gap-6 items-start">

          
          <div className="lg:col-span-5">
            <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 p-8 space-y-8 relative overflow-hidden">
              
              <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-emerald-400/50 to-transparent" />

              <SpeedDial
                value={earnedWages}
                max={earnedWages || 10000}
                currency={currency}
                isMonthlyProgress={true}
              />

              <div className="flex items-center justify-center gap-8 py-2">
                <div className="text-center">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Transfer Fee</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {calculateFeePercentage(employee?.risk_score ?? 3.0).toFixed(1)}%
                  </p>
                </div>
                <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />
                <div className="text-center">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Speed</p>
                  <p className="text-sm font-bold text-emerald-500 flex items-center gap-1">
                    <Zap className="w-3 h-3 fill-current" /> Instant
                  </p>
                </div>
              </div>

              <Button
                onClick={() => router.push('/dashboards/employee-dashboard/request-advance')}
                disabled={!isVerified || advanceLimit <= 0}
                className="w-full h-13 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm uppercase tracking-widest shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Wallet className="w-4 h-4 mr-2" /> Withdraw Funds
              </Button>
            </div>
          </div>

          
          <div className="lg:col-span-7 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <StatBlock icon={TrendingUp} label="Earned Wages" value={formatCurrency(earnedWages, currency)} sub="Accrued this cycle" variant="emerald" />
              <StatBlock icon={Calendar} label="Next Payday" value={payday.date} sub={`${payday.daysUntil} days remaining`} variant="blue" />
              <StatBlock icon={History} label="Withdrawn" value={formatCurrency(totalAdvances, currency)} sub="Total this month" variant="amber" />
              <StatBlock icon={Building2} label="Employer" value={employee?.employer_name || 'N/A'} sub={employee?.job_title || 'Verified Partner'} variant="purple" />
            </div>

            {kycPending && (
              <button
                onClick={() => router.push('/dashboards/employee-dashboard/onboarding')}
                className="w-full bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-2xl border border-emerald-400/20 p-4 flex items-center justify-between group hover:border-emerald-400/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: '#10b98112', border: '1px solid #10b98125' }}>
                    <Shield className="w-4 h-4 text-emerald-500 animate-pulse" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Identity Review</p>
                    <p className="text-[10px] text-slate-400">Your verification is being processed.</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        </div>

        
        {/* ── Advance Calculator promo card ─────────────────────────────────── */}
        <Link
          href="/dashboards/employee-dashboard/calculator"
          className="group flex items-center justify-between p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-700/30 bg-gradient-to-r from-emerald-50/80 to-teal-50/60 dark:from-emerald-900/20 dark:to-teal-900/10 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Advance Calculator</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">See fees and your net amount before you request</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-semibold group-hover:gap-2.5 transition-all">
            Calculate <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <div className="grid lg:grid-cols-12 gap-6">


          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Recent Activity</p>
              <Link href="/dashboards/employee-dashboard/transactions"
                className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 hover:text-emerald-600 transition-colors">
                View All
              </Link>
            </div>

            <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 overflow-hidden">
              {stats?.recent_transactions?.length ? (
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {stats.recent_transactions.slice(0, 4).map((tx) => (
                    <div key={tx.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-white/2 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center border",
                          tx.type === 'disbursement'
                            ? "bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/10 text-slate-400"
                            : "border-emerald-400/20 text-emerald-500"
                          )}
                          style={tx.type !== 'disbursement' ? { background: '#10b98110' } : {}}>
                          {tx.type === 'disbursement'
                            ? <ArrowDownLeft className="w-4 h-4" />
                            : <ArrowUpRightIcon className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white leading-none">
                            {tx.type === 'disbursement' ? 'Withdrawal' : 'Advance Request'}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                            {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-sm font-bold tabular-nums",
                          tx.type === 'disbursement' ? "text-slate-600 dark:text-slate-300" : "text-emerald-500")}>
                          {tx.type === 'disbursement' ? '−' : ''}{formatCurrency(tx.amount, currency).split('.')[0]}
                        </p>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">{tx.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center">
                  <History className="w-10 h-10 text-slate-200 dark:text-white/10 mx-auto mb-3" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No recent activity</p>
                </div>
              )}
            </div>
          </div>

          
          <div className="lg:col-span-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Account Health</p>

            <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 p-5 space-y-5">
              <div className="space-y-3">
                {[
                  { icon: CheckCircle2, label: 'Identity', value: employee?.kyc_status, accent: '#10b981' },
                  { icon: Landmark, label: 'Employment', value: employee?.status, accent: '#3b82f6' },
                ].map(({ icon: Icon, label, value, accent }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: `${accent}12`, border: `1px solid ${accent}25` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</span>
                    </div>
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-wider",
                      isVerified ? "text-emerald-500" : "text-amber-500"
                    )}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">Security</p>
                <Link href="/dashboards/employee-dashboard/settings">
                  <Button variant="outline" className="w-full h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-colors">
                    Manage Profile
                  </Button>
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </EmployeePortalLayout>
  );
}
