"use client";

import React, { useState, useCallback } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Mail, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/auth';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

type PageState = 'idle' | 'loading' | 'success' | 'error';

interface Recaptcha {
  ready(callback: () => void): void;
  execute(siteKey: string, options: { action: string }): Promise<string>;
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';

export default function SessionExpiredPage() {
  const router = useRouter();
  const supabase = createClient();
  const user = useAuthStore(s => s.user);

  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [pageState, setPageState] = useState<PageState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [recaptchaReady, setRecaptchaReady] = useState(false);

  const getReCaptchaToken = useCallback((action: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!RECAPTCHA_SITE_KEY) return reject(new Error('reCAPTCHA site key not configured'));
      const grecaptcha = (window as unknown as { grecaptcha: Recaptcha }).grecaptcha;
      if (!recaptchaReady || !grecaptcha) return reject(new Error('reCAPTCHA not ready'));
      grecaptcha.ready(async () => {
        try {
          resolve(await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action }));
        } catch (error) {
          reject(error);
        }
      });
    });
  }, [recaptchaReady]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleReauth();
  };

  // Try navigating back in history when possible; fall back to admin root.
  const navigateBackOrFallback = () => {
    try {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back();
      } else {
        router.push('/admin');
      }
    } catch {
      router.push('/admin');
    }
  };

  async function handleReauth(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setErrorMessage('');
    setPageState('loading');

    try {
      const res = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (res.error) {
        setErrorMessage(res.error.message ?? 'Failed to re-authenticate');
        setPageState('error');
        return;
      }

      setPageState('success');
      // Redirect back to previous page or fallback to admin
      navigateBackOrFallback();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg ?? 'Unexpected error');
      setPageState('error');
    }
  }

  async function sendMagicLink() {
    setErrorMessage('');
    setPageState('loading');

    try {
      const recaptchaToken = await getReCaptchaToken('session_reauth');

      const res = await fetch('/api/auth/send-session-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), recaptcha_token: recaptchaToken }),
      });

      // Read body as text first because server may return an HTML error page (e.g., 500 error HTML).
      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { text };
      }

      if (!res.ok) {
        const msg = data?.error ?? data?.message ?? data?.text ?? 'Failed to send magic link';
        setErrorMessage(msg);
        setPageState('error');
        return;
      }

      setPageState('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg ?? 'Unexpected error');
      setPageState('error');
    }
  }

  const isSubmitting = pageState === 'loading';

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">

          <div className="relative mx-auto mb-8 w-20 h-20">
            <div className="w-20 h-20 bg-linear-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/30 mx-auto">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <div className="absolute inset-0 bg-green-600/20 rounded-2xl blur-xl -z-10" />
          </div>

          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">Check your inbox</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">If an account exists for <span className="font-semibold text-slate-700 dark:text-slate-300">{email}</span>, you&apos;ll receive a link shortly.</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mb-10">The link expires in 1 hour. Check your spam folder if you don&apos;t see it.</p>

          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => { setPageState('idle'); setPassword(''); }} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2","w-full h-12 rounded-xl bg-linear-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold shadow-lg shadow-green-600/25 transition-all")}>
              Try signing in
            </button>
            <Link href="/admin" className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-green-600 hover:text-green-600 transition-all">
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </div>

        </div>
      </div>
    );
  }

  return (
    <>
      <Script src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`} strategy="lazyOnload" onReady={() => setRecaptchaReady(true)} />

      <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(22,163,74,0.08)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(15,23,42,0.06)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.06)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute top-20 right-0 w-125 h-125 bg-green-500/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-100 h-100 bg-slate-900/5 dark:bg-green-900/10 rounded-full blur-[120px] pointer-events-none" />

        <header className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-end">
          </div>
        </header>

        <main className="relative z-10 flex items-center justify-center min-h-[calc(100vh-120px)] px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-md">

            <div className="flex justify-center mb-6">
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
              <h1 className="text-4xl font-bold font-serif text-slate-900 dark:text-white leading-tight mb-4 tracking-tight">
                Session timed out
              </h1>
              <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed">
              We detected you have been inactive for sometime. Re-enter your password or request a magic link to continue.
              </p>
            </div>

            {pageState === 'error' && errorMessage && (
              <Alert className="mb-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 rounded-xl">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-red-600 dark:text-red-400">{errorMessage}</AlertDescription>
              </Alert>
            )}

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 rounded-3xl p-8 shadow-xl shadow-slate-900/5">
              <div className="flex flex-col gap-5">

                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">Email Address</label>
                  <div className="relative">
                    <Input type="email" placeholder="you@company.com" className="h-14 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyDown} autoComplete="email" autoFocus />
                    <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  </div>
                </div>

                <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">Password</label>
                <Input type="password" placeholder="Your password" className="h-14 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500" value={password} onChange={(e) => setPassword(e.target.value)} />

                <div className="flex flex-col sm:flex-row gap-3">
                  <button type="button" onClick={handleReauth} disabled={isSubmitting} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2","w-full h-14 rounded-2xl bg-linear-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold text-base shadow-lg shadow-green-600/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed")}>
                    {isSubmitting ? (<span className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Re-entering…</span>) : (<span className="flex items-center gap-2">Re-enter password<ArrowRight className="w-4 h-4" /></span>)}
                  </button>

                  <button type="button" onClick={sendMagicLink} disabled={!recaptchaReady || !email || isSubmitting} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2","w-full sm:w-auto h-14 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-green-600 hover:text-green-600 transition-all")}>
                    {isSubmitting ? (<span className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-slate-300 rounded-full animate-spin" />Sending…</span>) : (<span className="flex items-center gap-2">Send magic link</span>)}
                  </button>
                </div>

                <Link href="/admin" className="flex items-center justify-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors pt-1"><ArrowLeft className="w-4 h-4" /> Back to Sign In</Link>

              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-1.5">
              <Lock className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-400">Protected by reCAPTCHA · Reset links expire in 1 hour</span>
            </div>

          </div>
        </main>
      </div>
    </>
  );
}
