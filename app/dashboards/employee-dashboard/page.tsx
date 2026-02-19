"use client"
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Wallet, TrendingUp, Clock, ArrowRight, 
  AlertCircle, CheckCircle2, History, Calendar, 
  Building2, Zap, ArrowUpRight, ChevronRight, Bell, X, Sun, Moon, LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, cn } from '@/lib/utils';
import { EmployeePageLayout } from '@/components/employee/EmployeeLayout';
import { useTheme } from '@/lib/ThemeContext';
import { logout } from '@/actions/auth';

interface NotificationItem {
  type: 'success' | 'info';
  title: string;
  message: string;
  time: string;
}
interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
}

interface RecentTransaction {
  id: string | number;
  type: string;
  amount: number;
  created_at: string;
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
}

const NotificationsPanel = ({ isOpen, onClose, notifications }: NotificationsPanelProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-start justify-end pt-16 px-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map((notif, i) => (
              <div key={i} className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div className="flex items-start gap-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", notif.type === 'success' ? 'bg-primary/10' : 'bg-blue-100 dark:bg-blue-500/20')}>
                    {notif.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <Bell className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{notif.title}</p>
                    <p className="text-xs text-slate-500">{notif.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{notif.time}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center">
              <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No notifications yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface DashboardHeaderProps {
  user: {
    full_name: string;
    profile_picture_url?: string;
  } | null;
  employee: EmployeeSummary | null;
}

const DashboardHeader = ({ user, employee }: DashboardHeaderProps) => {
  const { theme, toggleTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  
  const notifications: NotificationItem[] = [
    { type: 'success', title: 'KYC Submitted', message: 'Your documents are under review', time: '2 hours ago' },
    { type: 'info', title: 'Welcome to EaziWage', message: 'Complete your profile to get started', time: '1 day ago' },
  ];
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <>
      <header className="relative z-10 max-w-md mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/employee/settings" className="shrink-0">
              {user?.profile_picture_url ? (
                <img 
                  src={`${process.env.REACT_APP_BACKEND_URL}${user.profile_picture_url}`} 
                  alt="Profile" 
                  className="w-10 h-10 rounded-xl object-cover ring-2 ring-primary/20"
                />
              ) : (
                <div className="w-10 h-10 bg-linear-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
                  <span className="text-white font-bold text-sm">{employee?.full_name?.[0] || user?.full_name?.[0] || 'U'}</span>
                </div>
              )}
            </Link>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{getGreeting()}</p>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {employee?.full_name?.split(' ')[0] || user?.full_name?.split(' ')[0] || 'User'}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
              data-testid="theme-toggle"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button 
              onClick={() => setShowNotifications(true)}
              className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
              data-testid="notifications-btn"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
              )}
            </button>
            <button 
              onClick={logout}
              className="p-2 rounded-xl text-slate-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
      
      <NotificationsPanel 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
      />
    </>
  );
};

interface SpeedDialCounterProps {
    value: number;
    max: number;
}
const SpeedDialCounter = ({ value, max }: SpeedDialCounterProps) => {
  const [displayValue, setDisplayValue] = useState(0);
  const animationRef = useRef<number | null>(null);
  
  useEffect(() => {
    const startTime = performance.now();
    const duration = 1500;
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * easeOut));
      if (progress < 1) animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [value]);
  
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const circumference = 2 * Math.PI * 44;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="relative w-48 h-48 mx-auto">
      {/* Outer glow */}
      <div className="absolute inset-2 rounded-full bg-primary/10 blur-xl" />
      
      {/* SVG Progress Ring */}
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Background track */}
        <circle 
          cx="50" cy="50" r="44" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="6" 
          className="text-slate-200 dark:text-slate-800/60" 
        />
        {/* Progress arc */}
        <circle 
          cx="50" cy="50" r="44" 
          fill="none" 
          stroke="url(#dialGradientDash)" 
          strokeWidth="6" 
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
        {/* Small dot markers around the circle */}
        {[...Array(12)].map((_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const x = 50 + 44 * Math.cos(angle);
          const y = 50 + 44 * Math.sin(angle);
          return (
            <circle 
              key={i}
              cx={x} cy={y} r="1.5"
              className={cn(
                "transition-colors duration-300",
                (i * 30) <= (percentage * 3.6) 
                  ? "fill-primary" 
                  : "fill-slate-300 dark:fill-slate-700"
              )}
            />
          );
        })}
        <defs>
          <linearGradient id="dialGradientDash" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0df259" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Center content - properly positioned to avoid overlay issues */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-center px-4">
          <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
            Available
          </span>
          <span className="block text-2xl font-bold text-slate-900 dark:text-white leading-none" data-testid="available-amount">
            {formatCurrency(displayValue)}
          </span>
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
interface StatCardProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | number;
    subtext?: string;
    iconBg?: string;
    iconColor?: string;
}
const StatCard = ({ icon: Icon, label, value, subtext, iconBg = "bg-primary/10", iconColor = "text-primary" }: StatCardProps) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-2.5", iconBg)}>
      <Icon className={cn("w-4 h-4", iconColor)} />
    </div>
    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-0.5">{label}</p>
    <p className="text-base font-bold text-slate-900 dark:text-white">{value}</p>
    {subtext && <p className="text-[10px] text-slate-400 mt-0.5">{subtext}</p>}
  </div>
);

export default function EmployeeDashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
    const [userProfile, setUserProfile] = useState<{ full_name: string; profile_picture_url?: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const user = userProfile || (employee?.full_name ? { full_name: employee.full_name, profile_picture_url: employee.profile_picture_url } : null);

    useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/employee/dashboard', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 404) {
            setError('profile_not_found');
          } else {
            setError(data?.message || 'Failed to load dashboard');
          }
          return;
        }
        const statsData: DashboardStats = data?.stats || data?.data?.stats || data?.data || {};
        const employeeData: EmployeeSummary | null = data?.employee || data?.data?.employee || null;
        const userData = data?.user || data?.profile || null;
        setStats(statsData);
        setEmployee(employeeData);
        if (userData?.full_name) {
          setUserProfile({
            full_name: userData.full_name,
            profile_picture_url: userData.profile_picture_url,
          });
        }
      } catch {
        const fallbackUser = JSON.parse(localStorage.getItem('eaziwage_user') || 'null');
        if (fallbackUser?.full_name) {
          setUserProfile({
            full_name: fallbackUser.full_name,
            profile_picture_url: fallbackUser.profile_picture_url,
          });
        } else {
          setError('Failed to load dashboard');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    }, []);

    const getNextPayday = () => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysUntil = Math.ceil((lastDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { date: lastDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), daysUntil };
  };

  if (loading) {
    return (
      <EmployeePageLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </EmployeePageLayout>
    );
  }

  if (error === 'profile_not_found') {
    return (
      <EmployeePageLayout>
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
          <div className="w-20 h-20 bg-linear-to-br from-primary/20 to-emerald-500/20 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
            <AlertCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 text-center">Complete Your Profile</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8 text-center text-sm max-w-xs">Set up your employee profile to start accessing wage advances.</p>
	          <Link href="/employee/onboarding">
	            <Button className="h-12 px-8 bg-linear-to-r from-primary to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 btn-glow" data-testid="complete-profile-btn">
              Get Started <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </EmployeePageLayout>
    );
  }

  const earnedWages = stats?.earned_wages || 0;
  const advanceLimit = stats?.advance_limit || 0;
  const totalAdvances = stats?.total_advances || 0;
  const kycPending = employee?.kyc_status === 'pending' || employee?.kyc_status === 'submitted';
  const canRequestAdvance = employee?.status === 'approved' && employee?.kyc_status === 'approved' && advanceLimit > 0;
  const payday = getNextPayday();

  return (
    <EmployeePageLayout>
      <DashboardHeader user={user} employee={employee} />

      <main className="relative z-10 max-w-md mx-auto px-4 pb-28 space-y-5">
        {/* KYC Alert Banner */}
        {kycPending && (
	          <div className="bg-linear-to-r from-primary/10 to-emerald-500/10 backdrop-blur-sm rounded-xl p-3.5 flex items-center gap-3 border border-primary/20" data-testid="kyc-alert">
            <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
              <AlertCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Verification in progress</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {employee?.kyc_status === 'submitted' ? 'Usually takes 1-2 business days' : 'Complete your KYC to continue'}
              </p>
            </div>
	            <Link href="/employee/onboarding">
              <ChevronRight className="w-5 h-5 text-primary" />
            </Link>
          </div>
        )}

        {/* Main Balance Card */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-slate-200/50 dark:border-slate-700/30" data-testid="balance-card">
          <SpeedDialCounter value={advanceLimit} max={earnedWages || advanceLimit * 2 || 10000} />
          
          {/* Quick Info Row */}
          <div className="flex items-center justify-center gap-6 mt-4 mb-5">
            <div className="text-center">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Fee</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">3.5% - 6%</span>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
            <div className="text-center">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Speed</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1">
                <Zap className="w-3 h-3 text-primary" /> Instant
              </span>
            </div>
          </div>

          {/* Request Button */}
	          <Link href="/employee/advances" className="block">
            <Button 
	              className="w-full h-12 rounded-xl bg-linear-to-r from-primary to-emerald-600 text-white font-semibold text-sm shadow-lg shadow-primary/25 btn-glow hover:shadow-xl transition-shadow"
              disabled={!canRequestAdvance} 
              data-testid="request-advance-btn"
            >
              <Wallet className="w-4 h-4 mr-2" /> 
              Request Advance
              <ArrowUpRight className="w-4 h-4 ml-auto" />
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3" data-testid="stats-grid">
          <StatCard 
            icon={TrendingUp} 
            label="Earned This Month" 
            value={formatCurrency(earnedWages)}
          />
          <StatCard 
            icon={Calendar} 
            label="Next Payday" 
            value={payday.date}
            subtext={`${payday.daysUntil} days away`}
            iconBg="bg-blue-100 dark:bg-blue-500/20"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <StatCard 
            icon={Wallet} 
            label="Total Withdrawn" 
            value={formatCurrency(totalAdvances)}
            iconBg="bg-amber-100 dark:bg-amber-500/20"
            iconColor="text-amber-600 dark:text-amber-400"
          />
          <StatCard 
            icon={Building2} 
            label="Employer" 
            value={employee?.employer_name?.split(' ')[0] || 'N/A'}
            subtext={employee?.job_title || 'Employee'}
            iconBg="bg-purple-100 dark:bg-purple-500/20"
            iconColor="text-purple-600 dark:text-purple-400"
          />
        </div>

        {/* Account Status */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden" data-testid="account-status">
          <div className="px-4 py-3 border-b border-slate-200/50 dark:border-slate-700/30 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Account Status</h3>
            <span className={cn(
              "text-[10px] font-semibold px-2 py-1 rounded-full",
              employee?.status === 'approved' && employee?.kyc_status === 'approved'
                ? "bg-primary/10 text-primary"
                : "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
            )}>
              {employee?.status === 'approved' && employee?.kyc_status === 'approved' ? 'Active' : 'Pending'}
            </span>
          </div>
          <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center",
                employee?.status === 'approved' ? 'bg-primary/10' : 'bg-slate-100 dark:bg-slate-800'
              )}>
                {employee?.status === 'approved' ? (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                ) : (
                  <Clock className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">Account</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white capitalize">{employee?.status || 'Pending'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center",
                employee?.kyc_status === 'approved' ? 'bg-primary/10' : 'bg-slate-100 dark:bg-slate-800'
              )}>
                {employee?.kyc_status === 'approved' ? (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                ) : (
                  <Clock className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">KYC Verification</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white capitalize">{employee?.kyc_status || 'Pending'}</p>
              </div>
              {employee?.kyc_status !== 'approved' && (
	                <Link href="/employee/onboarding">
                  <Button size="sm" variant="ghost" className="text-primary text-xs h-7 px-3">Complete</Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden" data-testid="recent-activity">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/50 dark:border-slate-700/30">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Activity</h3>
	            <Link href="/employee/transactions" className="text-xs font-semibold text-primary flex items-center gap-1">
              View All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
	          {(stats?.recent_transactions?.length || 0) > 0 ? (
	            <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
	              {(stats?.recent_transactions || []).slice(0, 3).map((tx: RecentTransaction) => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center",
                      tx.type === 'disbursement' ? 'bg-slate-100 dark:bg-slate-800' : 'bg-primary/10'
                    )}>
                      {tx.type === 'disbursement' ? (
                        <Wallet className="w-4 h-4 text-slate-500" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {tx.type === 'disbursement' ? 'Withdrawal' : 'Advance Request'}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-sm font-bold",
                    tx.type === 'disbursement' ? 'text-slate-600 dark:text-slate-300' : 'text-primary'
                  )}>
                    {tx.type === 'disbursement' ? '-' : ''}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <History className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">No transactions yet</p>
              <p className="text-xs text-slate-400 mt-1">Your activity will appear here</p>
            </div>
          )}
        </div>
      </main>
    </EmployeePageLayout>
  );
}
