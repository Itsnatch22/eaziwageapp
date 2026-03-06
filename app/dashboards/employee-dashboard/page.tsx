"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Wallet, TrendingUp, Clock, ArrowRight, 
  AlertCircle, CheckCircle2, History, Calendar, 
  Building2, Zap, ArrowUpRight, ChevronRight, Bell, X, 
  Shield, CreditCard, Landmark, Loader2, Sparkles,
  ArrowDownLeft, ArrowUpRight as ArrowUpRightIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, cn } from '@/lib/utils';
import { EmployeePortalLayout } from '@/components/employee/EmployeeLayout';
import { logout } from '@/actions/auth';
import { useAuthStore } from '@/lib/stores/auth';
import pusherClient from '@/lib/pusher-client';

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

// ─── Components ───────────────────────────────────────────────────────────────

const SpeedDial = ({ value, max, currency = 'KES' }: { value: number; max: number; currency?: string }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const circumference = 2 * Math.PI * 44;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="relative w-64 h-64 mx-auto group">
      {/* Background Aura */}
      <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-700" />
      
      <svg className="absolute inset-0 w-full h-full -rotate-90 z-10" viewBox="0 0 100 100">
        <circle 
          cx="50" cy="50" r="44" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="3" 
          className="text-slate-100 dark:text-slate-800/50" 
        />
        <circle 
          cx="50" cy="50" r="44" 
          fill="none" 
          stroke="url(#dialGrad)" 
          strokeWidth="6" 
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-[1.5s] ease-out shadow-2xl"
        />
        <defs>
          <linearGradient id="dialGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0df259" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-2">Unlocked Funds</p>
        <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
          {formatCurrency(value, currency).split('.')[0]}
        </h2>
        <div className="mt-4 px-4 py-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest shadow-xl">
          Available Now
        </div>
      </div>
    </div>
  );
};

const StatBlock = ({ icon: Icon, label, value, sub, variant = "blue" }: { icon: React.ElementType; label: string; value: React.ReactNode; sub?: string; variant?: string }) => {
  const variants: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    purple: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  };

  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/30 rounded-3xl p-5 shadow-sm hover:shadow-lg transition-all duration-300">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 border", variants[variant])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{value}</h3>
      {sub && <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">{sub}</p>}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function EmployeeDashboardPage() {
    const user = useAuthStore((state) => state.user);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const fetchStats = async () => {
      try {
        const response = await fetch('/api/employee-dashboard/overview');
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 404) setError('profile_not_found');
          else setError(data?.message || 'Error');
          return;
        }
        setStats(data.stats);
        setEmployee(data.employee);
      } catch {
        setError('Failed to load');
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchStats();
    }, []);

    useEffect(() => {
      if (!user?.id || !pusherClient) return;

      const channel = pusherClient.subscribe(`user-${user.id}`);
      
      const handleUpdate = (data: any) => {
        console.log('[Pusher] Employee KYC update received:', data);
        void fetchStats();
      };

      channel.bind('kyc-update', handleUpdate);

      return () => {
        channel.unbind('kyc-update', handleUpdate);
        pusherClient!.unsubscribe(`user-${user.id}`);
      };
    }, [user?.id]);

    const getNextPayday = () => {
      const today = new Date();
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const daysUntil = Math.ceil((lastDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { date: lastDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), daysUntil };
    };

  if (loading) {
    return (
      <EmployeePortalLayout title="Syncing...">
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Verifying Ledger...</p>
        </div>
      </EmployeePortalLayout>
    );
  }

  if (error === 'profile_not_found') {
    return (
      <EmployeePortalLayout title="Welcome">
        <div className="max-w-md mx-auto text-center py-12 space-y-8">
          <div className="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl">
            <Sparkles className="w-12 h-12 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Setup Required</h1>
            <p className="text-slate-500 dark:text-slate-400">Your employee profile is not yet fully configured. Let&apos;s get you started.</p>
          </div>
          <Button onClick={() => router.push('/dashboards/employee-dashboard/onboarding')} className="h-16 px-10 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-primary/20 hover:scale-105 transition-all w-full">
            Start Onboarding <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </EmployeePortalLayout>
    );
  }

  const earnedWages = stats?.earned_wages || 0;
  const advanceLimit = stats?.advance_limit || 0;
  const totalAdvances = stats?.total_advances || 0;
  const kycPending = employee?.kyc_status === 'pending' || employee?.kyc_status === 'submitted';
  const isVerified = employee?.kyc_status === 'approved' && employee?.status === 'approved';
  const payday = getNextPayday();

  return (
    <EmployeePortalLayout title="Overview">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Hero Section */}
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          
          {/* Left: Dial */}
          <div className="lg:col-span-5 text-center">
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-[3rem] p-10 border border-white/40 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-black/20 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-primary to-indigo-600" />
              <SpeedDial value={advanceLimit} max={earnedWages || 10000} currency={employee?.currency} />
              
              <div className="mt-8 space-y-6">
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Transfer Fee</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">3.5% Flat</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Transfer Speed</p>
                    <p className="text-sm font-bold text-emerald-600 flex items-center justify-center gap-1">
                      <Zap className="w-3 h-3 fill-current" /> Instant
                    </p>
                  </div>
                </div>

                <Button 
                  onClick={() => router.push('/dashboards/employee-dashboard/request-advance')}
                  disabled={!isVerified || advanceLimit <= 0}
                  className="w-full h-16 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-[0.15em] shadow-2xl shadow-slate-200 dark:shadow-black/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <Wallet className="w-5 h-5 mr-3" /> Withdraw Funds
                </Button>
              </div>
            </div>
          </div>

          {/* Right: Stats Grid */}
          <div className="lg:col-span-7 space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <StatBlock 
                icon={TrendingUp} 
                label="Earned Wage" 
                value={formatCurrency(earnedWages, employee?.currency)} 
                sub="Accrued this cycle"
                variant="emerald"
              />
              <StatBlock 
                icon={Calendar} 
                label="Next Payday" 
                value={payday.date} 
                sub={`${payday.daysUntil} days remaining`}
                variant="blue"
              />
              <StatBlock 
                icon={History} 
                label="Withdrawn" 
                value={formatCurrency(totalAdvances, employee?.currency)} 
                sub="Total this month"
                variant="amber"
              />
              <StatBlock 
                icon={Building2} 
                label="Employer" 
                value={employee?.employer_name || 'N/A'} 
                sub={employee?.job_title || 'Verified Partner'}
                variant="purple"
              />
            </div>

            {/* Verification Alert */}
            {kycPending && (
              <div className="bg-primary/5 border border-primary/20 rounded-[2rem] p-6 flex items-center justify-between group cursor-pointer hover:bg-primary/10 transition-all" onClick={() => router.push('/dashboards/employee-dashboard/onboarding')}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-sm">
                    <Shield className="w-6 h-6 text-primary animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">Identity Review</h4>
                    <p className="text-xs text-slate-500 font-medium">Your verification is being processed.</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section: Activity & Status */}
        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Recent Transactions */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Recent Ledger</h3>
              <Link href="/dashboards/employee-dashboard/transactions" className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">
                View All History
              </Link>
            </div>
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/30 rounded-[2.5rem] overflow-hidden shadow-sm">
              {stats?.recent_transactions?.length ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.recent_transactions.slice(0, 4).map((tx) => (
                    <div key={tx.id} className="p-5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-white/2 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center border",
                          tx.type === 'disbursement' ? "bg-slate-50 border-slate-100 text-slate-400" : "bg-primary/5 border-primary/10 text-primary"
                        )}>
                          {tx.type === 'disbursement' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRightIcon className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white leading-none mb-1">
                            {tx.type === 'disbursement' ? 'Withdrawal' : 'Advance Request'}
                          </p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-sm font-black", tx.type === 'disbursement' ? "text-slate-600 dark:text-slate-300" : "text-primary")}>
                          {tx.type === 'disbursement' ? '-' : ''}{formatCurrency(tx.amount, employee?.currency).split('.')[0]}
                        </p>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{tx.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center">
                  <History className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Recent Activity</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Access / Status */}
          <div className="lg:col-span-4 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-2">Account Health</h3>
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/30 rounded-[2.5rem] p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 border border-emerald-500/20">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">Identity</span>
                  </div>
                  <span className={cn("text-[9px] font-black uppercase tracking-widest", isVerified ? "text-emerald-600" : "text-amber-600")}>
                    {employee?.kyc_status}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 border border-blue-500/20">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">Employment</span>
                  </div>
                  <span className={cn("text-[9px] font-black uppercase tracking-widest", isVerified ? "text-emerald-600" : "text-amber-600")}>
                    {employee?.status}
                  </span>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Security Settings</p>
                <Link href="/dashboards/employee-dashboard/settings">
                  <Button variant="outline" className="w-full h-12 rounded-xl border-slate-200 dark:border-slate-700 font-bold text-[10px] uppercase tracking-widest">
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
