'use client';

import React, { useState, useCallback } from 'react';
import Script        from 'next/script';
import Link          from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, ArrowLeft, Mail, Lock,
  CheckCircle2, AlertCircle, Sun, Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input }            from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState = 'idle' | 'loading' | 'success' | 'error';

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

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';

// ─── Component ────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email,          setEmail]          = useState('');
  const [pageState,      setPageState]      = useState<PageState>('idle');
  const [errorMessage,   setErrorMessage]   = useState('');
  const [recaptchaReady, setRecaptchaReady] = useState(false);

  const getReCaptchaToken = useCallback((action: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!RECAPTCHA_SITE_KEY)             return reject(new Error('reCAPTCHA site key not configured'));
      if (!recaptchaReady || !window.grecaptcha) return reject(new Error('reCAPTCHA not ready'));
      window.grecaptcha.ready(async () => {
        try {
          resolve(await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action }));
        } catch (err) {
          reject(err);
        }
      });
    });
  }, [recaptchaReady]);

  const handleSubmit = useCallback(async () => {
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Please enter your email address');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    setPageState('loading');
    try {
      const recaptchaToken = await getReCaptchaToken('forgot_password');

      const res = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:           email.trim().toLowerCase(),
          recaptcha_token: recaptchaToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? 'Something went wrong. Please try again.');
        setPageState('error');
        return;
      }

      setPageState('success');
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
      setPageState('error');
    }
  }, [email, getReCaptchaToken]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const isSubmitting = pageState === 'loading';

  // ─── Success state ──────────────────────────────────────────────────────────

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">

          {/* Success icon */}
          <div className="relative mx-auto mb-8 w-20 h-20">
            <div className="w-20 h-20 bg-linear-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/30 mx-auto">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <div className="absolute inset-0 bg-green-600/20 rounded-2xl blur-xl -z-10" />
          </div>

          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
            Check your inbox
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
            If an account exists for{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{email}</span>,
            you&apos;ll receive a password reset link shortly.
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mb-10">
            The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => { setEmail(''); setPageState('idle'); }}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2",
                "w-full h-12 rounded-xl bg-linear-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold shadow-lg shadow-green-600/25 transition-all"
              )}
            >
              Try a different email
            </button>
            <Link
              href="/"
              className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-green-600 hover:text-green-600 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </div>

        </div>
      </div>
    );
  }

  // ─── Main form ──────────────────────────────────────────────────────────────

  return (
    <>
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
        strategy="lazyOnload"
        onReady={() => setRecaptchaReady(true)}
      />

      <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 relative overflow-hidden">

        {/* Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(22,163,74,0.08)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(15,23,42,0.06)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.06)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute top-20 right-0 w-125 h-125 bg-green-500/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-100 h-100 bg-slate-900/5 dark:bg-green-900/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Header */}
        <header className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-end">
          </div>
        </header>

        {/* Main */}
        <main className="relative z-10 flex items-center justify-center min-h-[calc(100vh-120px)] px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-md">

            {/* Logo */}
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

            {/* Icon */}
            <div className="flex justify-center mb-8">
              <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl flex items-center justify-center">
                <Lock className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>

            {/* Headline */}
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold font-serif text-slate-900 dark:text-white leading-tight mb-4 tracking-tight">
                Forgot your{' '}
                <span className="bg-linear-to-r from-green-600 to-green-500 bg-clip-text text-transparent">
                  password?
                </span>
              </h1>
              <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed">
                No worries. Enter the email address linked to your account and we&apos;ll send you a reset link.
              </p>
            </div>

            {/* Error */}
            {pageState === 'error' && errorMessage && (
              <Alert className="mb-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 rounded-xl">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-red-600 dark:text-red-400">{errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Card */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 rounded-3xl p-8 shadow-xl shadow-slate-900/5">
              <div className="flex flex-col gap-5">

                {/* Email */}
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">
                    Email Address
                  </label>
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
                    />
                    <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !recaptchaReady}
                  className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2",
                    "w-full h-14 rounded-2xl bg-linear-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold text-base shadow-lg shadow-green-600/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  )}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending reset link…
                    </span>
                  ) : !recaptchaReady ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Loading security check…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Send Reset Link
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  )}
                </button>

                {/* Back to login */}
                <Link
                  href="/"
                  className="flex items-center justify-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors pt-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </Link>

              </div>
            </div>

            {/* Security note */}
            <div className="mt-6 flex items-center justify-center gap-1.5">
              <Lock className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-400">
                Protected by reCAPTCHA · Reset links expire in 1 hour
              </span>
            </div>

          </div>
        </main>
      </div>
    </>
  );
}

