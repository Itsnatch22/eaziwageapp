'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Script       from 'next/script';
import Link         from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2, XCircle, Eye, EyeOff,
  Lock, ArrowRight, ShieldCheck, KeyRound, Wallet
} from 'lucide-react';
import { cn }                  from '@/lib/utils';
import { Input }                   from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

// ─── Types ────────────────────────────────────────────────────────────────────

type ResetState =
  | 'idle'       // Form ready — user enters new password
  | 'submitting' // POST in-flight
  | 'success'    // Password changed — countdown to login
  | 'invalid';   // Token missing / expired / already used

// ─── Global reCAPTCHA ─────────────────────────────────────────────────────────

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

const RECAPTCHA_SITE_KEY  = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';
const AUTO_REDIRECT_SECS  = 5;

// ─── Password strength ────────────────────────────────────────────────────────

interface StrengthResult {
  score: number;     // 0–4
  label: string;
  color: string;     // Tailwind bg class
}

function getPasswordStrength(password: string): StrengthResult {
  if (!password) return { score: 0, label: '', color: 'bg-slate-200 dark:bg-slate-700' };

  let score = 0;
  if (password.length >= 8)                        score++;
  if (password.length >= 12)                       score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password))                         score++;
  if (/[^A-Za-z0-9]/.test(password))              score++;

  // Clamp to 4
  score = Math.min(score, 4);

  const map: Record<number, Omit<StrengthResult, 'score'>> = {
    0: { label: 'Too weak',  color: 'bg-red-500' },
    1: { label: 'Weak',      color: 'bg-red-400' },
    2: { label: 'Fair',      color: 'bg-slate-400' },
    3: { label: 'Good',      color: 'bg-green-500' },
    4: { label: 'Strong',    color: 'bg-green-600' },
  };

  return { score, ...map[score] };
}

// ─── Countdown sub-component ──────────────────────────────────────────────────

interface CountdownProps {
  seconds: number;
  onComplete: () => void;
}

function Countdown({ seconds, onComplete }: CountdownProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) { onComplete(); return; }
    const t = setTimeout(() => setRemaining((n) => n - 1), 1_000);
    return () => clearTimeout(t);
  }, [remaining, onComplete]);

  return (
    <span className="tabular-nums font-semibold text-green-600 dark:text-green-400">
      {remaining}s
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get('token');

  const [state,          setState]          = useState<ResetState>(token ? 'idle' : 'invalid');
  const [password,       setPassword]       = useState('');
  const [confirm,        setConfirm]        = useState('');
  const [showPassword,   setShowPassword]   = useState(false);
  const [showConfirm,    setShowConfirm]    = useState(false);
  const [formError,      setFormError]      = useState('');
  const [recaptchaReady, setRecaptchaReady] = useState(false);

  const strength = getPasswordStrength(password);

  // ── reCAPTCHA v3 helper ─────────────────────────────────────────────────────
  const getReCaptchaToken = useCallback(
    (action: string): Promise<string> =>
      new Promise((resolve, reject) => {
        if (!RECAPTCHA_SITE_KEY)
          return reject(new Error('reCAPTCHA site key not configured'));
        if (!recaptchaReady || !window.grecaptcha)
          return reject(new Error('reCAPTCHA not ready'));

        window.grecaptcha.ready(async () => {
          try {
            resolve(await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action }));
          } catch (err) {
            reject(err);
          }
        });
      }),
    [recaptchaReady],
  );

  // ── Validate client-side before hitting the API ─────────────────────────────
  const validate = useCallback((): string | null => {
    if (password.length < 8)
      return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password))
      return 'Password must contain at least one uppercase letter.';
    if (!/[0-9]/.test(password))
      return 'Password must contain at least one number.';
    if (password !== confirm)
      return 'Passwords do not match.';
    return null;
  }, [password, confirm]);

  // ── Submit handler ──────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    setFormError('');

    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setState('submitting');

    try {
      const recaptchaToken = await getReCaptchaToken('reset_password');

      const res  = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          token,
          password,
          recaptcha_token: recaptchaToken,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setState('success');
        return;
      }

      if (data.code === 'TOKEN_INVALID' || data.code === 'TOKEN_EXPIRED') {
        setState('invalid');
        return;
      }

      setFormError(data.error ?? 'Something went wrong. Please try again.');
      setState('idle');
    } catch {
      setFormError('Something went wrong. Please try again.');
      setState('idle');
    }
  }, [token, password, getReCaptchaToken, validate]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit();
  };

  // ─── Render states ────────────────────────────────────────────────────────

  const renderContent = () => {
    switch (state) {

      // ── Idle / Submitting — main form ────────────────────────────────────────
      case 'idle':
      case 'submitting':
        return (
          <div>
            <div className="flex justify-center mb-8">
              <div className="relative w-16 h-16">
                <div className="w-16 h-16 bg-linear-to-br from-green-600 to-green-800 rounded-2xl flex items-center justify-center shadow-lg shadow-green-700/30">
                  <KeyRound className="w-8 h-8 text-white" strokeWidth={1.75} />
                </div>
                <div className="absolute inset-0 bg-green-600/20 rounded-2xl blur-xl -z-10" />
              </div>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold font-serif text-slate-900 dark:text-white mb-3 tracking-tight">
                Set new password
              </h1>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-sm">
                Choose a strong password. It must be at least 8 characters and
                include an uppercase letter and a number.
              </p>
            </div>

            {formError && (
              <Alert className="mb-5 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 rounded-xl">
                <AlertDescription className="text-red-600 dark:text-red-400 text-sm">
                  {formError}
                </AlertDescription>
              </Alert>
            )}

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 rounded-3xl p-8 shadow-xl shadow-slate-900/5">
              <div className="flex flex-col gap-5">

                {/* New password */}
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      className="h-14 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 text-slate-900 dark:text-white placeholder:text-slate-400"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoComplete="new-password"
                      autoFocus
                      disabled={state === 'submitting'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword
                        ? <EyeOff className="w-5 h-5" />
                        : <Eye    className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Strength meter */}
                  {password && (
                    <div className="flex items-center gap-2 px-1">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                          style={{ width: `${(strength.score / 4) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-14 text-right">
                        {strength.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Re-enter your password"
                      className="h-14 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 text-slate-900 dark:text-white placeholder:text-slate-400"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoComplete="new-password"
                      disabled={state === 'submitting'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirm
                        ? <EyeOff className="w-5 h-5" />
                        : <Eye    className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Match indicator */}
                  {confirm && (
                    <p className={`text-xs ml-1 ${password === confirm
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-500 dark:text-red-400'}`}
                    >
                      {password === confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={state === 'submitting' || !recaptchaReady}
                  className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2",
                    "w-full h-14 rounded-2xl bg-linear-to-r from-green-700 via-green-600 to-green-500 hover:from-green-800 hover:via-green-700 hover:to-green-600 text-white font-semibold text-base shadow-lg shadow-green-600/25 transition-all disabled:opacity-60"
                  )}
                >
                  {state === 'submitting' ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Updating password…
                    </span>
                  ) : !recaptchaReady ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Loading security check…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Lock className="w-5 h-5" />
                      Set New Password
                    </span>
                  )}
                </button>

                <Link
                  href="/"
                  className="text-sm text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors text-center"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          </div>
        );

      // ── Success ───────────────────────────────────────────────────────────────
      case 'success':
        return (
          <div className="text-center">
            <div className="relative mx-auto mb-8 w-20 h-20">
              <div className="w-20 h-20 bg-linear-to-br from-green-500 to-green-700 rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/30">
                <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={1.75} />
              </div>
              <div className="absolute inset-0 bg-green-600/20 rounded-2xl blur-xl -z-10" />
            </div>

            <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
              Password updated!
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
              Your password has been changed successfully. Redirecting to sign in in{' '}
              <Countdown
                seconds={AUTO_REDIRECT_SECS}
                onComplete={() => router.replace('/')}
              />
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mb-10">
              All active sessions have been signed out for your security.
            </p>

            <button
              type="button"
              onClick={() => router.replace('/')}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2",
                "w-full h-12 rounded-xl bg-linear-to-r from-green-700 to-green-500 hover:from-green-800 hover:to-green-600 text-white font-semibold shadow-lg shadow-green-600/25 transition-all"
              )}
            >
              <span className="flex items-center gap-2">
                Sign In Now
                <ArrowRight className="w-4 h-4" />
              </span>
            </button>
          </div>
        );

      // ── Invalid / expired token ───────────────────────────────────────────────
      case 'invalid':
        return (
          <div className="text-center">
            <div className="relative mx-auto mb-8 w-20 h-20">
              <div className="w-20 h-20 bg-linear-to-br from-slate-700 to-black rounded-2xl flex items-center justify-center shadow-lg shadow-black/30">
                <XCircle className="w-10 h-10 text-white" strokeWidth={1.75} />
              </div>
              <div className="absolute inset-0 bg-slate-900/20 rounded-2xl blur-xl -z-10" />
            </div>

            <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
              Link invalid or expired
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed">
              This password reset link is invalid or has expired. Reset links are
              valid for 1 hour. Please request a new one.
            </p>

            <div className="flex flex-col gap-3">
              <Link
                href="/forgot-password"
                className="w-full h-12 rounded-xl bg-linear-to-r from-green-700 to-green-500 hover:from-green-800 hover:to-green-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-green-600/25 transition-all text-sm"
              >
                Request a new reset link
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/"
                className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-green-600 hover:text-green-600 transition-all"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        );
    }
  };

  // ─── Page shell ───────────────────────────────────────────────────────────

  return (
    <>
      {/* reCAPTCHA v3 — loaded lazily, badge hidden via CSS per Google policy compliance */}
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
        strategy="lazyOnload"
        onReady={() => setRecaptchaReady(true)}
      />

      <style>{`.grecaptcha-badge { visibility: hidden !important; }`}</style>

      <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 relative overflow-hidden">
        {/* Background atmosphere — white/green/slate/black palette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(22,163,74,0.07)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(15,23,42,0.04)_0%,transparent_50%)] pointer-events-none" />
        <div className="absolute top-24 right-0 w-120 h-120 bg-green-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-95 h-95 bg-slate-900/4 dark:bg-slate-100/2 rounded-full blur-[100px] pointer-events-none" />

        <main className="relative z-10 flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 py-16">
          <div className="w-full max-w-md">

            {/* Logo — shown on the form states */}
            {(state === 'idle' || state === 'submitting') && (
              <div className="flex justify-center mb-6">
                <Link href="/" className="flex items-center gap-3 group">
                  <div className="relative">
                    <div className="w-11 h-11 bg-linear-to-br from-green-600 to-green-800 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-green-700/30">
                      <Wallet
                        className="h-8 w-8 text-emerald-700"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="absolute inset-0 bg-green-600/20 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300 -z-10" />
                  </div>
                  <span className="font-bold text-2xl text-slate-900 dark:text-white tracking-tight">
                    EaziWage
                  </span>
                </Link>
              </div>
            )}

            {renderContent()}

            {/* reCAPTCHA disclosure — required by Google ToS when badge is hidden */}
            {(state === 'idle' || state === 'submitting') && (
              <div className="mt-6 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-400">
                  Protected by reCAPTCHA ·{' '}
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-slate-600 transition-colors"
                  >
                    Privacy
                  </a>
                  {' & '}
                  <a
                    href="https://policies.google.com/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-slate-600 transition-colors"
                  >
                    Terms
                  </a>
                </span>
              </div>
            )}

          </div>
        </main>
      </div>
    </>
  );
}

