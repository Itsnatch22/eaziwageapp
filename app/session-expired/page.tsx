'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

type PageState = 'idle' | 'loading' | 'success' | 'error';
type AppRole = 'admin' | 'employer' | 'employee';

export default function SessionExpiredPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pageState, setPageState] = useState<PageState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const disableBackNavigation = () => {
      window.history.pushState(null, '', window.location.href);
    };

    window.addEventListener('popstate', disableBackNavigation);
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('popstate', disableBackNavigation);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !password.trim()) return;
    if (e.key === 'Enter') handleReauth();
  };

  const normalizeAppRole = (value: unknown): AppRole | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'admin' || normalized === 'employer' || normalized === 'employee') {
      return normalized;
    }
    return null;
  };

  const getDashboardPath = async (userId: string): Promise<string> => {
    try {
      const { data: adminRow, error: adminError } = await supabase
        .from('system_admins')
        .select('id')
        .eq('id', userId)
        .maybeSingle<{ id: string }>();

      if (!adminError && adminRow) {
        return '/admin';
      }

      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('role, role_normalized, is_admin')
        .eq('id', userId)
        .maybeSingle<{ role: string; role_normalized: string | null; is_admin: boolean }>();

      if (!profileError && profileRow) {
        if (profileRow.is_admin) {
          return '/admin';
        }

        const role = normalizeAppRole(profileRow.role_normalized) ?? normalizeAppRole(profileRow.role);
        if (role === 'employer') return '/dashboards/employer-dashboard';
        if (role === 'employee') return '/dashboards/employee-dashboard';
        if (role === 'admin') return '/admin';
      }

      const [{ data: employerOnboarding }, { data: employerRecord }, { data: employeeOnboarding }, { data: employeeRecord }] =
        await Promise.all([
          supabase
            .from('employer_onboarding')
            .select('id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle<{ id: string }>(),
          supabase
            .from('employers')
            .select('id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle<{ id: string }>(),
          supabase
            .from('employee_onboarding')
            .select('id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle<{ id: string }>(),
          supabase
            .from('employees')
            .select('id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle<{ id: string }>(),
        ]);

      if (employerOnboarding || employerRecord) {
        return '/dashboards/employer-dashboard';
      }

      if (employeeOnboarding || employeeRecord) {
        return '/dashboards/employee-dashboard';
      }

      return '/admin';
    } catch (error) {
      console.error('Error determining dashboard path:', error);
      return '/admin';
    }
  };

  async function handleReauth(e?: React.FormEvent) {
    if (e) e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Email and password are required');
      setPageState('error');
      return;
    }

    setErrorMessage('');
    setPageState('loading');

    try {
      const res = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (res.error) {
        setErrorMessage(res.error.message ?? 'Failed to re-authenticate');
        setPageState('error');
        return;
      }

      if (!res.data.user?.id) {
        setErrorMessage('Authentication succeeded but user ID not found');
        setPageState('error');
        return;
      }

      const dashboardPath = await getDashboardPath(res.data.user.id);
      setPageState('success');
      router.replace(dashboardPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg ?? 'Unexpected error');
      setPageState('error');
    }
  }

  const isSubmitting = pageState === 'loading';

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(22,163,74,0.08)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(15,23,42,0.06)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.06)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute top-20 right-0 w-125 h-125 bg-green-500/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-100 h-100 bg-slate-900/5 dark:bg-green-900/10 rounded-full blur-[120px] pointer-events-none" />

      <main className="relative z-10 flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="w-12 h-12 bg-linear-to-br from-emerald-500/20 to-green-500/20 ring-1 ring-emerald-500/20 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-emerald-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/10 border border-slate-100 dark:border-slate-800">
                  <Lock className="h-8 w-8 text-emerald-700" strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="absolute inset-0 bg-green-600/20 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300 -z-10" />
              </div>
              <span className="font-bold text-2xl text-slate-900 dark:text-white tracking-tight">EaziWage</span>
            </Link>
          </div>

          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white leading-tight mb-4 tracking-tight">
              Session timed out
            </h1>
            <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed">
              Your session has expired for security reasons. Please re-enter your credentials to continue.
            </p>
          </div>

          {pageState === 'error' && errorMessage && (
            <Alert className="mb-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 rounded-xl">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-600 dark:text-red-400">{errorMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleReauth} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 rounded-3xl p-8 shadow-xl shadow-slate-900/5">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">Email Address</label>
                <div className="relative">
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    className="h-14 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="email"
                    autoFocus
                    disabled={isSubmitting}
                  />
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Your password"
                    className="h-14 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    disabled={isSubmitting}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !email.trim() || !password.trim()}
                className={cn(
                  'w-full h-14 rounded-2xl bg-linear-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold text-base shadow-lg shadow-green-600/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2'
                )}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Re-entering…
                  </>
                ) : (
                  <>
                    Re-enter password
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Having trouble accessing your account?{' '}
              <Link href="/forgot-password" className="text-green-600 hover:text-green-700 font-medium transition-colors">
                Reset password
              </Link>
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center gap-1.5">
            <Lock className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-400">Your account is protected by industry-standard security</span>
          </div>
        </div>
      </main>
    </div>
  );
}
