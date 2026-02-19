// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Users, TrendingUp, Clock, ArrowRight, CreditCard, Building2, Upload, 
  BarChart3, AlertCircle, CheckCircle2, ArrowUpRight, ChevronRight,
  Wallet, Zap, Calendar, DollarSign, Activity, PieChart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmployerPortalLayout } from '@/components/employer/EmployerLayout';
import { dashboardApi, employerApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { GradientIconBox } from '@/components/employer/SharedComponents';

interface DashboardStats {
  total_employees?: number;
  active_employees?: number;
  monthly_advances_disbursed?: number;
  total_advances_disbursed?: number;
  avg_fee_rate?: number;
  monthly_payroll?: number;
  avg_advance_amount?: number;
}

interface EmployerData {
  company_name?: string;
  status?: string;
  industry?: string;
  payroll_cycle?: string;
  risk_score?: number;
}

// Animated Counter Component
const AnimatedCounter = ({ value, prefix = '', suffix = '' }: { value: number | string; prefix?: string; suffix?: string }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const animationRef = useRef<number | null>(null);
  
  useEffect(() => {
    const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
    const startTime = performance.now();
    const duration = 1200;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(numValue * easeOut));
      if (progress < 1) animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [value]);
  
  return <span>{prefix}{displayValue.toLocaleString()}{suffix}</span>;
};

// Main Stats Card
const MainStatsCard = ({ stats, employer }: { stats: DashboardStats | null; employer: EmployerData | null }) => {
  const totalEmployees = stats?.total_employees || 0;
  const activeEmployees = stats?.active_employees || 0;
  const percentage = totalEmployees > 0 ? Math.round((activeEmployees / totalEmployees) * 100) : 0;
  const circumference = 2 * Math.PI * 44;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-slate-200/50 dark:border-slate-700/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Company Overview</h2>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{employer?.company_name}</p>
        </div>
        <div className={cn(
          "px-3 py-1.5 rounded-full text-xs font-semibold",
          employer?.status === 'approved' 
            ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
            : "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300"
        )}>
          {employer?.status === 'approved' ? 'Verified' : 'Pending'}
        </div>
      </div>

      {/* Circular Progress */}
      <div className="relative w-40 h-40 mx-auto mb-6">
        <div className="absolute inset-2 rounded-full bg-primary/10 blur-xl" />
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6" 
            className="text-slate-200 dark:text-slate-800/60" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="url(#employerGradient)" strokeWidth="6" 
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out" />
          <defs>
            <linearGradient id="employerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0df259" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-slate-900 dark:text-white">
            <AnimatedCounter value={totalEmployees} />
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Employees</span>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="flex items-center justify-center gap-8">
        <div className="text-center">
          <span className="text-2xl font-bold text-primary">{activeEmployees}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">Active</span>
        </div>
        <div className="w-px h-10 bg-slate-200 dark:bg-slate-700" />
        <div className="text-center">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">{percentage}%</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">Utilization</span>
        </div>
      </div>
    </div>
  );
};

// Metric Card with gradient icon (matches website)
const MetricCard = ({ icon: Icon, label, value, subtext, trend, trendUp }: { icon: any; label: string; value: any; subtext: string; trend?: string; trendUp?: boolean }) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30 hover:shadow-lg transition-all duration-300 group">
    <div className="flex items-start justify-between mb-3">
      <GradientIconBox icon={Icon} size="md" />
      {trend && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
          trendUp ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600" : "bg-red-100 dark:bg-red-500/20 text-red-600"
        )}>
          <ArrowUpRight className={cn("w-3 h-3", !trendUp && "rotate-180")} />
          {trend}
        </div>
      )}
    </div>
    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
    {subtext && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtext}</p>}
  </div>
);

// Quick Action Card with gradient icon (matches website)
const QuickActionCard = ({ icon: Icon, title, description, href }: { icon: any; title: string; description: string; href: string }) => (
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

// Status Item with gradient icon (matches website)
const StatusItem = ({ icon: Icon, label, value, status }: { icon: any; label: string; value: any; status: 'success' | 'warning' | 'default' }) => (
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

export default function EmployerDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [employer, setEmployer] = useState<EmployerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, employerRes] = await Promise.all([
          dashboardApi.getEmployerDashboard(),
          employerApi.getMe()
        ]);
        setStats(statsRes.data);
        setEmployer(employerRes.data);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setError('profile_not_found');
        } else {
          setError('Failed to load dashboard data');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <EmployerPortalLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-14 h-14 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </EmployerPortalLayout>
    );
  }

  if (error === 'profile_not_found') {
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
          <Link href="/employer/onboarding">
            <Button className="h-12 px-8 bg-linear-to-r from-primary to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-shadow" data-testid="complete-profile-btn">
              Complete Setup <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </EmployerPortalLayout>
    );
  }

  const isPending = employer?.status === 'pending';

  return (
    <EmployerPortalLayout employer={employer}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Verification Alert */}
        {isPending && (
          <div className="bg-linear-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4 border border-amber-500/20" data-testid="verification-alert">
            <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 dark:text-amber-200">Verification in Progress</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300/80 mt-0.5">
                Your company profile is being reviewed. This usually takes 1-2 business days.
              </p>
            </div>
          </div>
        )}

        {/* Top Section - Main Stats + Metrics */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Stats Card */}
          <MainStatsCard stats={stats} employer={employer} />

          {/* Metrics Grid */}
          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
            <MetricCard 
              icon={DollarSign}
              label="Advances This Month"
              value={formatCurrency(stats?.monthly_advances_disbursed || stats?.total_advances_disbursed || 0)}
              subtext="This month's disbursements"
              trend="+12.5%"
              trendUp={true}
            />
            <MetricCard 
              icon={TrendingUp}
              label="Avg. Fee Rate"
              value={`${(stats?.avg_fee_rate || 4.5).toFixed(1)}%`}
              subtext="Based on risk score"
            />
            <MetricCard 
              icon={Wallet}
              label="Monthly Payroll"
              value={formatCurrency(stats?.monthly_payroll || 0)}
              subtext="This month's total"
              trend="+8.2%"
              trendUp={true}
            />
            <MetricCard 
              icon={Activity}
              label="Avg. Advance"
              value={formatCurrency(stats?.avg_advance_amount || 5000)}
              subtext="Per employee"
              trend="-2.1%"
              trendUp={false}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Quick Actions</h2>
            <Link href="/employer/payroll" className="text-sm font-medium text-primary flex items-center gap-1 hover:gap-2 transition-all">
              Upload Payroll <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickActionCard 
              icon={Users}
              title="Manage Employees"
              description="Add, edit, or view profiles"
              href="/employer/employees"
            />
            <QuickActionCard 
              icon={Upload}
              title="Upload Payroll"
              description="Update earnings data"
              href="/employer/payroll"
            />
            <QuickActionCard 
              icon={CreditCard}
              title="View Advances"
              description="Track wage advances"
              href="/employer/advances"
            />
            <QuickActionCard 
              icon={BarChart3}
              title="Reports"
              description="Analytics and insights"
              href="/employer/reports"
            />
          </div>
        </div>

        {/* Bottom Section - Company Status + Risk */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Company Status */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-5">Company Status</h2>
            <div className="space-y-3">
              <StatusItem 
                icon={CheckCircle2}
                label="Verification Status"
                value={employer?.status === 'approved' ? 'Fully Verified' : 'Under Review'}
                status={employer?.status === 'approved' ? 'success' : 'warning'}
              />
              <StatusItem 
                icon={Building2}
                label="Industry"
                value={employer?.industry?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Not Set'}
                status="default"
              />
              <StatusItem 
                icon={Calendar}
                label="Payroll Cycle"
                value={employer?.payroll_cycle?.charAt(0).toUpperCase() + employer?.payroll_cycle?.slice(1) || 'Monthly'}
                status="default"
              />
            </div>
          </div>

          {/* Risk Score */}
          <div className="bg-linear-to-br from-primary/5 to-emerald-500/5 dark:from-primary/10 dark:to-emerald-500/10 backdrop-blur-sm rounded-2xl p-6 border border-primary/10 dark:border-primary/20">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Risk Assessment</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Your company's risk profile</p>
              </div>
              <div className={cn(
                "px-4 py-2 rounded-xl font-semibold text-sm",
                (employer?.risk_score || 3.5) >= 4 ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' :
                (employer?.risk_score || 3.5) >= 3 ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' :
                (employer?.risk_score || 3.5) >= 2.6 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' :
                'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
              )}>
                {(employer?.risk_score || 3.5) >= 4 ? 'Low Risk' :
                 (employer?.risk_score || 3.5) >= 3 ? 'Medium Risk' :
                 (employer?.risk_score || 3.5) >= 2.6 ? 'High Risk' : 'Very High Risk'}
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="relative w-24 h-24">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" 
                    className="text-white/50 dark:text-slate-700/50" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="url(#riskGradient)" strokeWidth="8" 
                    strokeLinecap="round" strokeDasharray={2 * Math.PI * 40} 
                    strokeDashoffset={2 * Math.PI * 40 * (1 - ((employer?.risk_score || 3.5) / 5))}
                    className="transition-all duration-1000" />
                  <defs>
                    <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#0df259" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {(employer?.risk_score || 3.5).toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Your risk score determines the fee rates applied to employee advances. A lower risk score means better rates for your employees.
                </p>
                <Link href="/employer/risk-insights" className="inline-flex items-center gap-1 text-sm font-medium text-primary mt-3 hover:gap-2 transition-all">
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

