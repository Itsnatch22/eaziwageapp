'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight, Eye, EyeOff, Mail, Lock,
  AlertCircle, Sparkles, Sun, Moon, Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoginPayload {
  email:           string;
  password:        string;
  recaptcha_token: string;
}

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

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');
  const safeNext =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : null;

  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [showPassword,   setShowPassword]   = useState(false);
  const [error,          setError]          = useState('');
  const [isLoading,      setIsLoading]      = useState(false);
  const [recaptchaReady, setRecaptchaReady] = useState(false);

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setError('');
    setIsLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?role=employee`,
      },
    });
    if (error) {
      setError(error.message);
      setIsLoading(false);
    }
  };

  /** Executes reCAPTCHA v3 and returns a fresh token for the given action. */
  const getReCaptchaToken = useCallback((action: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!RECAPTCHA_SITE_KEY)            return reject(new Error('reCAPTCHA site key not configured'));
      if (!recaptchaReady || !window.grecaptcha) return reject(new Error('reCAPTCHA not ready'));
      window.grecaptcha.ready(async () => {
        try {
          const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
          resolve(token);
        } catch (err) {
          reject(err);
        }
      });
    });
  }, [recaptchaReady]);

  const handleSubmit = useCallback(async () => {
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password');
      return;
    }

    setIsLoading(true);
    try {
      const recaptchaToken = await getReCaptchaToken('login');

      const payload: LoginPayload = {
        email:           email.trim().toLowerCase(),
        password,
        recaptcha_token: recaptchaToken,
      };

      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Login failed. Please check your credentials.');
        return;
      }

      // Role-based redirect — Supabase session is in httpOnly cookies set by the API
      let defaultDestination = '/';
      switch (data.role as string) {
        case 'admin':
          defaultDestination = '/admin';
          break;
        case 'employer':
          defaultDestination = '/dashboards/employer-dashboard';
          break;
        case 'employee':
          defaultDestination = '/dashboards/employee-dashboard';
          break;
      }
      router.push(safeNext ?? defaultDestination);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, getReCaptchaToken, router, safeNext]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSubmit(); };

  return (
    <>
      {/**
       * reCAPTCHA v3 — lazyOnload defers the script until after the page
       * becomes interactive, keeping the login form fast to render.
       * The button stays disabled until onReady fires.
       */}
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
        strategy="lazyOnload"
        onReady={() => setRecaptchaReady(true)}
      />

      <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 relative overflow-hidden">

        {/* Background layers */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(22,163,74,0.08)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(15,23,42,0.06)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.06)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute top-20 right-0 w-150 h-150 bg-green-500/8 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-125 h-125 bg-slate-900/5 dark:bg-green-900/10 rounded-full blur-[150px] pointer-events-none" />

        {/* Main */}
        <main className="relative z-10 flex items-center justify-center min-h-[calc(100vh-120px)] px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-md">

            {/* Logo */}
            <div className="flex justify-center mb-6">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="relative">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-green-600/10 border border-slate-100 dark:border-slate-800">
                    <Wallet
                      className="h-8 w-8 text-emerald-700"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="absolute inset-0 bg-green-600/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300 -z-10" />
                </div>
                <span className="font-bold text-2xl text-slate-900 dark:text-white tracking-tight">EaziWage</span>
              </Link>
            </div>

            {/* Badge */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full text-sm font-semibold text-green-700 dark:text-green-400">
                <Sparkles className="w-4 h-4" />
                Welcome back to EaziWage
              </div>
            </div>

            {/* Headline */}
            <div className="text-center mb-10">
              <h1 className="text-4xl font-serif sm:text-5xl font-bold text-slate-900 dark:text-white leading-tight mb-4 tracking-tight">
                Sign In to Your{' '}
                <span className="bg-linear-to-r from-green-600 to-green-500 bg-clip-text text-transparent">
                  Account
                </span>
              </h1>
              <p className="text-lg text-slate-500 dark:text-slate-400">
                Access your earnings, anytime, anywhere.
              </p>
            </div>

            {/* Error */}
            {error && (
              <Alert className="mb-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 rounded-xl">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-red-600 dark:text-red-400">{error}</AlertDescription>
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
                    />
                    <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••"
                      className="h-14 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-green-600 transition-colors"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Forgot password */}
                <div className="flex justify-end -mt-2">
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>

                {/* Submit */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading || !recaptchaReady}
                  className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2",
                    "w-full h-14 mt-2 rounded-2xl bg-linear-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold text-base shadow-lg shadow-green-600/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  )}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in…
                    </span>
                  ) : !recaptchaReady ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Loading security check…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Sign In
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  )}
                </button>

                {/* Social Login */}
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-slate-900 px-2 text-slate-500 dark:text-slate-400">
                      Or
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2",
                      "h-12 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium text-slate-700 dark:text-slate-300"
                    )}
                    onClick={() => handleSocialLogin('google')}
                  >
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Google
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2",
                      "h-12 rounded-xl border-slate-200 hover:bg-slate-50 transition-colors font-medium text-slate-700"
                    )}
                    onClick={() => handleSocialLogin('apple')}
                  >
                    <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 384 512">
                      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 33-17.9 63.4-17.9 31.8 0 39.6 17.9 65.4 17.9 48.6-.1 90.7-82.5 103-119.5-31.9-14.5-54.6-43.9-54.7-91.7zM224.2 81.1c16-19.8 26.8-47.3 23.8-74.7-23.4 1-51.5 15.6-68.3 35.4-15 17.5-28.2 45.4-24.8 71.9 26.2 2 53.2-12.8 69.3-32.6z"/>
                    </svg>
                    Apple
                  </button>
                </div>

                {/* Security note */}
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-400">
                    Bank-grade 256-bit encryption · Protected by reCAPTCHA
                  </span>
                </div>
                <div className="mt-8 text-center">
                  <p className="text-slate-500 dark:text-slate-400">
                    New to EaziWage?{' '}
                    <Link href="/register" className="text-green-600 dark:text-green-400 font-semibold hover:underline">
                      Create an account
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
