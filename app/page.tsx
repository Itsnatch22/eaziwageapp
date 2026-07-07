'use client';

import React, { useState, useCallback } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight, Eye, EyeOff, Mail, Lock,
  AlertCircle, Sparkles, Wallet, Quote
} from 'lucide-react';

const testimonials = [
  {
    quote: "Building this one was a process, but am glad we finally got to establish it. Eaziwage is here to change our perspectives on how payroll systems work. Trust is the new currency and advance payment is how it's earned.",
    name: "Mark K.",
    title: "Co-Founder & Lead Dev",
  },
  {
    quote: "We are building more than just a payment platform we are creating a bridge of trust. One that supports growth, accelerates timelines, reduces cancellations, and brings professionalism to every transaction.",
    name: "Joel O",
    title: "Co-Founder & Backend Dev",
  },
  {
    quote: "At EaziWage, we're not just streamlining payments we're empowering connections, fostering trust, and driving success by making every transaction seamless, engaging, and impactful.",
    name: "Henry K.",
    title: "Co-Founder & CMO",
  },
  {
    quote: "As a business owner, I witnessed the stress financial delays can bring to good people. We built EaziWage to create a bridge between effort and reward so that paydays reflect the rhythm of real life, not the limits of outdated systems.",
    name: "Jason C.",
    title: "Co-Founder & CEO",
  },
];

function TestimonialsPanel() {
  const [active, setActive] = React.useState(0);
  const [stats, setStats] = React.useState({
    employeesServed: '10K+',
    satisfactionRate: '98%',
    interestRate: '0%'
  });

  React.useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    fetch('/api/public/stats')
      .then(res => res.json())
      .then(data => {
        setStats({
          employeesServed: data.employeesServed,
          satisfactionRate: data.satisfactionRate,
          interestRate: data.interestRate
        });
      })
      .catch(err => console.error('Failed to fetch stats:', err));

    return () => clearInterval(timer);
  }, []);

  const t = testimonials[active];

  return (
    <div className="hidden lg:flex flex-col justify-between h-full min-h-screen bg-linear-to-br from-green-700 via-green-600 to-emerald-500 p-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.12)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-400/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-125 bg-green-800/20 rounded-full blur-[150px] pointer-events-none" />

      
      <div className="flex items-center gap-3 relative z-10">
        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
          <Wallet className="w-6 h-6 text-white" strokeWidth={2} />
        </div>
        <span className="font-bold text-xl text-white tracking-tight">EaziWage</span>
      </div>

      
      <div className="relative z-10 flex flex-col gap-8">
        <div>
          <h2 className="text-4xl font-serif font-bold text-white leading-snug mb-3">
            Payroll that works<br />at the speed of life.
          </h2>
          <p className="text-green-100 text-base leading-relaxed max-w-sm">
            Be among the first to trust EaziWage for seamless, instant wage access.
          </p>
        </div>

        
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-xl transition-all duration-500">
          <Quote className="w-8 h-8 text-green-200 mb-4 opacity-80" />
          <p className="text-white text-base leading-relaxed mb-6 min-h-20">
            {t.quote}
          </p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white font-bold text-sm">
              {t.name.charAt(0)}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{t.name}</p>
              <p className="text-green-200 text-xs">{t.title}</p>
            </div>
          </div>
        </div>

        
        <div className="flex items-center gap-2">
          {testimonials.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`rounded-full transition-all duration-300 ${
                i === active
                  ? 'w-6 h-2 bg-white'
                  : 'w-2 h-2 bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>

      
      <div className="relative z-10 grid grid-cols-3 gap-4">
        {[
          { value: stats.employeesServed, label: 'Active Users' },
          { value: stats.satisfactionRate, label: 'Satisfaction Rate' },
          { value: stats.interestRate, label: 'Interest Rate' },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-white font-bold text-xl">{stat.value}</p>
            <p className="text-green-200 text-xs mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';


interface LoginPayload {
  email:           string;
  password:        string;
  recaptcha_token: string;
  fingerprint_visitor_id?: string;
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

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';

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
    const callbackUrl = new URL('/api/auth/callback', window.location.origin);
    callbackUrl.searchParams.set('source', 'login');
    if (safeNext) {
      callbackUrl.searchParams.set('next', safeNext);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });
    if (error) {
      setError(error.message);
      setIsLoading(false);
    }
  };

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
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
        strategy="lazyOnload"
        onReady={() => setRecaptchaReady(true)}
      />

      <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 relative overflow-hidden lg:flex">

        
        <div className="lg:w-[45%] lg:shrink-0">
          <TestimonialsPanel />
        </div>

        
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(22,163,74,0.08)_0%,transparent_60%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(15,23,42,0.06)_0%,transparent_60%)] pointer-events-none" />

          <main className="relative z-10 flex items-center justify-center px-4 sm:px-6 lg:px-10 py-6">
            <div className="w-full max-w-md">

            <div className="flex justify-center mb-4">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="relative">
                  <div className="w-10 h-10 bg-linear-to-br from-emerald-500/20 to-green-500/20 ring-1 ring-emerald-500/20 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-emerald-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/10 border border-slate-100 dark:border-slate-800">
                    <Wallet
                      className="h-6 w-6 text-emerald-700"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="absolute inset-0 bg-green-600/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300 -z-10" />
                </div>
                <span className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">EaziWage</span>
              </Link>
            </div>

            <div className="flex justify-center mb-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full text-xs font-semibold text-green-700 dark:text-green-400">
                <Sparkles className="w-3.5 h-3.5" />
                Welcome back to EaziWage
              </div>
            </div>

            <div className="text-center mb-6">
              <h1 className="text-3xl font-serif sm:text-4xl font-bold text-slate-900 dark:text-white leading-tight mb-2 tracking-tight">
                Sign In to Your{' '}
                <span className="bg-linear-to-r from-green-600 to-green-500 bg-clip-text text-transparent">
                  Account
                </span>
              </h1>
              <p className="text-base text-slate-500 dark:text-slate-400">
                Access your earnings, anytime, anywhere.
              </p>
            </div>

            {error && (
              <Alert className="mb-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 rounded-xl">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-red-600 dark:text-red-400">{error}</AlertDescription>
              </Alert>
            )}

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 rounded-3xl p-5 shadow-xl shadow-slate-900/5">
              <div className="flex flex-col gap-3">

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Input
                      type="email"
                      placeholder="you@company.com"
                      className="h-12 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoComplete="email"
                    />
                    <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••"
                      className="h-12 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
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

                <div className="flex justify-end -mt-2">
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading || !recaptchaReady}
                  className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2",
                    "w-full h-12 mt-1 rounded-2xl bg-linear-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold text-base shadow-lg shadow-green-600/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
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

                <div className="relative my-1">
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
                      "h-10 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium text-slate-700 dark:text-slate-300"
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
                      "h-10 rounded-xl border-slate-200 hover:bg-slate-50 transition-colors font-medium text-slate-700"
                    )}
                    onClick={() => handleSocialLogin('apple')}
                  >
                    <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 384 512">
                      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 33-17.9 63.4-17.9 31.8 0 39.6 17.9 65.4 17.9 48.6-.1 90.7-82.5 103-119.5-31.9-14.5-54.6-43.9-54.7-91.7zM224.2 81.1c16-19.8 26.8-47.3 23.8-74.7-23.4 1-51.5 15.6-68.3 35.4-15 17.5-28.2 45.4-24.8 71.9 26.2 2 53.2-12.8 69.3-32.6z"/>
                    </svg>
                    Apple
                  </button>
                </div>

                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-400">
                    Bank-grade 256-bit encryption · Protected by reCAPTCHA
                  </span>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
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
      </div>
    </>
  );
}
