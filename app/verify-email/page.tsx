'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Script        from 'next/script';
import Link          from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2, XCircle, Clock, Mail,
  ArrowRight, RefreshCw, Lock,
} from 'lucide-react';
import { Button }                     from '@/components/ui/button';
import { Input }                      from '@/components/ui/input';
import { Alert, AlertDescription }    from '@/components/ui/alert';

// ─── Types ────────────────────────────────────────────────────────────────────

type VerifyState =
  | 'verifying'   // Token is being checked
  | 'success'     // Verified successfully
  | 'expired'     // Token expired
  | 'invalid'     // Token not found / already used
  | 'resend'      // No token in URL — show resend form
  | 'resent';     // Resend email sent

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      render: (container: string | HTMLElement, parameters: Record<string, unknown>) => number;
      reset: (widgetId?: number) => void;
    };
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RECAPTCHA_SITE_KEY   = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';
const AUTO_REDIRECT_SECS   = 5;

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Animated countdown that fires onComplete when it hits 0. */
function Countdown({ seconds, onComplete }: { seconds: number; onComplete: () => void }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) { onComplete(); return; }
    const t = setTimeout(() => setRemaining((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onComplete]);

  return (
    <span className="tabular-nums font-semibold text-green-600 dark:text-green-400">
      {remaining}s
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VerifyEmailPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get('token');

  const [state,          setState]          = useState<VerifyState>(token ? 'verifying' : 'resend');
  const [userRole,       setUserRole]       = useState<string>('employee');
  const [resendEmail,    setResendEmail]    = useState('');
  const [resendError,    setResendError]    = useState('');
  const [resendLoading,  setResendLoading]  = useState(false);
  const [recaptchaReady, setRecaptchaReady] = useState(false);

  const hasVerified = useRef(false);

  // ── Auto-verify on mount when token is present ──────────────────────────────
  useEffect(() => {
    if (!token || hasVerified.current) return;
    hasVerified.current = true;

    const verify = async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ token }),
        });

        const data = await res.json();

        if (res.ok) {
          setUserRole(data.role ?? 'employee');
          setState('success');
          return;
        }

        if (data.code === 'TOKEN_EXPIRED') {
          setState('expired');
          return;
        }

        // TOKEN_INVALID, already used, or any other failure
        setState('invalid');
      } catch {
        setState('invalid');
      }
    };

    verify();
  }, [token]);

  // ── reCAPTCHA helper ────────────────────────────────────────────────────────
  const getReCaptchaToken = useCallback((action: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!RECAPTCHA_SITE_KEY)                 return reject(new Error('Site key not configured'));
      if (!recaptchaReady || !window.grecaptcha) return reject(new Error('reCAPTCHA not ready'));
      window.grecaptcha.ready(async () => {
        try { resolve(await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action })); }
        catch (err) { reject(err); }
      });
    });
  }, [recaptchaReady]);

  // ── Resend handler ──────────────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    setResendError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!resendEmail.trim() || !emailRegex.test(resendEmail.trim())) {
      setResendError('Please enter a valid email address');
      return;
    }

    setResendLoading(true);
    try {
      const recaptchaToken = await getReCaptchaToken('resend_verification');

      const res = await fetch('/api/auth/verify-email/resend', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:           resendEmail.trim().toLowerCase(),
          recaptcha_token: recaptchaToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResendError(data.error ?? 'Failed to resend. Please try again.');
        return;
      }

      setState('resent');
    } catch {
      setResendError('Something went wrong. Please try again.');
    } finally {
      setResendLoading(false);
    }
  }, [resendEmail, getReCaptchaToken]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleResend(); };

  const dashboardUrl =
    userRole === 'employer'
      ? '/dashboards/employer-dashboard'
      : '/dashboards/employee-dashboard';

  // ─── Render states ──────────────────────────────────────────────────────────

  const renderContent = () => {
    switch (state) {

      // ── Verifying ────────────────────────────────────────────────────────────
      case 'verifying':
        return (
          <div className="text-center">
            <div className="relative mx-auto mb-8 w-16 h-16">
              <div className="w-16 h-16 bg-linear-to-br from-green-600 to-green-700 rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/30 animate-pulse">
                <span className="text-white font-bold text-2xl">E</span>
              </div>
              <div className="absolute inset-0 bg-green-600/20 rounded-2xl blur-xl -z-10" />
            </div>
            <div className="flex justify-center mb-6">
              <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-700 border-t-green-600 rounded-full animate-spin" />
            </div>
            <p className="text-base font-medium text-slate-600 dark:text-slate-300">
              Verifying your email…
            </p>
            <p className="mt-2 text-sm text-slate-400">Please don&apos;t close this tab</p>
          </div>
        );

      // ── Success ──────────────────────────────────────────────────────────────
      case 'success':
        return (
          <div className="text-center">
            <div className="relative mx-auto mb-8 w-20 h-20">
              <div className="w-20 h-20 bg-linear-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/30">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <div className="absolute inset-0 bg-green-600/20 rounded-2xl blur-xl -z-10" />
            </div>

            <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
              Email verified!
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
              Your EaziWage account is now fully active. you&apos;re being redirected in{' '}
              <Countdown seconds={AUTO_REDIRECT_SECS} onComplete={() => router.replace(dashboardUrl)} />.
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mb-10">
              {userRole === 'employer' ? 'Head to your employer dashboard to onboard your team.' : 'Head to your dashboard to access your earned wages.'}
            </p>

            <Button
              type="button"
              onClick={() => router.replace(dashboardUrl)}
              className="w-full h-12 rounded-xl bg-linear-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold shadow-lg shadow-green-600/25 transition-all"
            >
              <span className="flex items-center gap-2">
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </span>
            </Button>
          </div>
        );

      // ── Expired ──────────────────────────────────────────────────────────────
      case 'expired':
        return (
          <div className="text-center">
            <div className="relative mx-auto mb-8 w-20 h-20">
              <div className="w-20 h-20 bg-linear-to-br from-amber-400 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Clock className="w-10 h-10 text-white" />
              </div>
              <div className="absolute inset-0 bg-amber-400/20 rounded-2xl blur-xl -z-10" />
            </div>

            <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
              Link expired
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed">
              This verification link has expired. Verification links are valid for 24 hours.
              Enter your email below and we&apos;ll send you a fresh one.
            </p>

            {resendError && (
              <Alert className="mb-5 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 rounded-xl text-left">
                <AlertDescription className="text-red-600 dark:text-red-400">{resendError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-3">
              <div className="relative">
                <Input
                  type="email"
                  placeholder="you@company.com"
                  className="h-14 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 text-slate-900 dark:text-white"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="email"
                  autoFocus
                />
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              </div>
              <Button
                type="button"
                onClick={handleResend}
                disabled={resendLoading || !recaptchaReady}
                className="w-full h-12 rounded-xl bg-linear-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold shadow-lg shadow-green-600/25 transition-all disabled:opacity-60"
              >
                {resendLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Resend Verification Email
                  </span>
                )}
              </Button>
              <Link href="/" className="text-sm text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors text-center">
                Back to Sign In
              </Link>
            </div>
          </div>
        );

      // ── Invalid ──────────────────────────────────────────────────────────────
      case 'invalid':
        return (
          <div className="text-center">
            <div className="relative mx-auto mb-8 w-20 h-20">
              <div className="w-20 h-20 bg-linear-to-br from-slate-400 to-slate-500 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-500/20">
                <XCircle className="w-10 h-10 text-white" />
              </div>
              <div className="absolute inset-0 bg-slate-500/10 rounded-2xl blur-xl -z-10" />
            </div>

            <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
              Invalid link
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed">
              This verification link is invalid or has already been used.
              If you need a new link, sign in and we&apos;ll prompt you to resend it, or request one below.
            </p>

            <div className="flex flex-col gap-3">
              <Button
                type="button"
                onClick={() => setState('resend')}
                className="w-full h-12 rounded-xl bg-linear-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold shadow-lg shadow-green-600/25 transition-all"
              >
                Request a new verification email
              </Button>
              <Link href="/" className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-green-600 hover:text-green-600 transition-all">
                Back to Sign In
              </Link>
            </div>
          </div>
        );

      // ── Resend form (no token in URL) ─────────────────────────────────────────
      case 'resend':
        return (
          <div>
            <div className="flex justify-center mb-8">
              <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl flex items-center justify-center">
                <Mail className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>

            <div className="text-center mb-10">
              <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
                Verify your email
              </h1>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                Enter your email address and we&apos;ll send you a verification link to activate your account.
              </p>
            </div>

            {resendError && (
              <Alert className="mb-5 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 rounded-xl">
                <AlertDescription className="text-red-600 dark:text-red-400">{resendError}</AlertDescription>
              </Alert>
            )}

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 rounded-3xl p-8 shadow-xl shadow-slate-900/5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">Email Address</label>
                  <div className="relative">
                    <Input
                      type="email"
                      placeholder="you@company.com"
                      className="h-14 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 text-slate-900 dark:text-white"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoComplete="email"
                      autoFocus
                    />
                    <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading || !recaptchaReady}
                  className="w-full h-14 rounded-2xl bg-linear-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold text-base shadow-lg shadow-green-600/25 transition-all disabled:opacity-60"
                >
                  {resendLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending…
                    </span>
                  ) : !recaptchaReady ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Loading security check…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Send Verification Email
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  )}
                </Button>

                <Link href="/" className="text-sm text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors text-center">
                  Back to Sign In
                </Link>
              </div>
            </div>
          </div>
        );

      // ── Resent confirmation ───────────────────────────────────────────────────
      case 'resent':
        return (
          <div className="text-center">
            <div className="relative mx-auto mb-8 w-20 h-20">
              <div className="w-20 h-20 bg-linear-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/30">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <div className="absolute inset-0 bg-green-600/20 rounded-2xl blur-xl -z-10" />
            </div>

            <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
              Email sent!
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
              We&apos;ve sent a verification link to{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{resendEmail}</span>.
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mb-10">
              The link expires in 24 hours. Check your spam folder if you don&apos;t see it.
            </p>
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400 hover:underline">
              Back to Sign In
            </Link>
          </div>
        );
    }
  };

  // ─── Page shell ─────────────────────────────────────────────────────────────

  return (
    <>
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
        strategy="lazyOnload"
        onReady={() => setRecaptchaReady(true)}
      />

      <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(22,163,74,0.08)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute top-20 right-0 w-125 h-125 bg-green-500/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-100 h-100 bg-slate-900/5 dark:bg-green-900/10 rounded-full blur-[120px] pointer-events-none" />

        <main className="relative z-10 flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 py-16">
          <div className="w-full max-w-md">

            {/* Logo — shown on states where there's no large icon */}
            {(state === 'resend') && (
              <div className="flex justify-center mb-6">
                <Link href="/" className="flex items-center gap-3 group">
                  <div className="relative">
                    <div className="w-12 h-12 bg-linear-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-green-600/30">
                      <span className="text-white font-bold text-2xl">E</span>
                    </div>
                    <div className="absolute inset-0 bg-green-600/20 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300 -z-10" />
                  </div>
                  <span className="font-bold text-2xl text-slate-900 dark:text-white tracking-tight">EaziWage</span>
                </Link>
              </div>
            )}

            {renderContent()}

            {/* Security note on form states */}
            {(state === 'resend' || state === 'expired') && (
              <div className="mt-6 flex items-center justify-center gap-1.5">
                <Lock className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-400">
                  Protected by reCAPTCHA · Links expire in 24 hours
                </span>
              </div>
            )}

          </div>
        </main>
      </div>
    </>
  );
}
