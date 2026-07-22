'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2, XCircle, Lock, ArrowRight, Wallet, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type UnlockState =
  | 'unlocking'
  | 'confirm'
  | 'submitting'
  | 'success'
  | 'already_unlocked'
  | 'invalid'
  | 'error';


const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';
const AUTO_REDIRECT_SECS = 5;

function Countdown({ seconds, onComplete }: { seconds: number; onComplete: () => void }) {
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

export default function UnlockAccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [state, setState] = useState<UnlockState>(
    token ? 'unlocking' : email ? 'confirm' : 'invalid',
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [recaptchaReady, setRecaptchaReady] = useState(false);

  const hasAttempted = useRef(false);

  const unlockWithToken = useCallback(async (unlockToken: string) => {
    try {
      const res = await fetch('/api/auth/unlock-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: unlockToken }),
      });

      const data = await res.json();

      if (res.ok) {
        setState(data.alreadyUnlocked ? 'already_unlocked' : 'success');
        return;
      }

      if (data.code === 'TOKEN_INVALID') {
        setState('invalid');
        return;
      }

      setErrorMessage(data.error ?? 'Something went wrong. Please try again.');
      setState('error');
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
      setState('error');
    }
  }, []);

  useEffect(() => {
    if (!token || hasAttempted.current) return;
    hasAttempted.current = true;
    unlockWithToken(token);
  }, [token, unlockWithToken]);

  const getReCaptchaToken = useCallback((action: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!RECAPTCHA_SITE_KEY) return reject(new Error('reCAPTCHA site key not configured'));
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

  const handleEmailUnlock = useCallback(async () => {
    if (!email) return;

    setErrorMessage('');
    setState('submitting');

    try {
      const recaptchaToken = await getReCaptchaToken('unlock_account');

      const res = await fetch('/api/auth/unlock-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          recaptcha_token: recaptchaToken,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setState(data.alreadyUnlocked ? 'already_unlocked' : 'success');
        return;
      }

      setErrorMessage(data.error ?? 'Something went wrong. Please try again.');
      setState('confirm');
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
      setState('confirm');
    }
  }, [email, getReCaptchaToken]);

  const renderContent = () => {
    switch (state) {
      case 'unlocking':
        return (
          <div className="text-center">
            <div className="relative mx-auto mb-8 w-16 h-16">
              <div className="w-16 h-16 bg-linear-to-br from-green-600 to-green-700 rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/30 animate-pulse">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <div className="absolute inset-0 bg-green-600/20 rounded-2xl blur-xl -z-10" />
            </div>
            <div className="flex justify-center mb-6">
              <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-700 border-t-green-600 rounded-full animate-spin" />
            </div>
            <p className="text-base font-medium text-slate-600 dark:text-slate-300">
              Unlocking your account…
            </p>
          </div>
        );

      case 'confirm':
      case 'submitting':
        return (
          <div className="text-center">
            <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
              Unlock your account
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              Your account was temporarily locked after too many failed sign-in attempts.
              Confirm below to unlock it immediately for{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{email}</span>.
            </p>

            {errorMessage && (
              <p className="mb-6 text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            )}

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleEmailUnlock}
                disabled={state === 'submitting' || !recaptchaReady}
                className={cn(
                  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2',
                  'w-full h-12 rounded-xl bg-linear-to-r from-green-700 to-green-500 hover:from-green-800 hover:to-green-600 text-white font-semibold shadow-lg shadow-green-600/25 transition-all',
                )}
              >
                {state === 'submitting' || !recaptchaReady ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {state === 'submitting' ? 'Unlocking…' : 'Loading security check…'}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Unlock Account Now
                  </span>
                )}
              </button>
              <Link
                href="/"
                className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-green-600 hover:text-green-600 transition-all"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        );

      case 'success':
      case 'already_unlocked':
        return (
          <div className="text-center">
            <div className="relative mx-auto mb-8 w-20 h-20">
              <div className="w-20 h-20 bg-linear-to-br from-green-500 to-green-700 rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/30">
                <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={1.75} />
              </div>
              <div className="absolute inset-0 bg-green-600/20 rounded-2xl blur-xl -z-10" />
            </div>

            <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
              {state === 'already_unlocked' ? 'Already unlocked' : 'Account unlocked!'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
              {state === 'already_unlocked'
                ? 'Your account is not locked. You can sign in now. Redirecting in '
                : 'Your account has been unlocked. Redirecting to sign in in '}
              <Countdown seconds={AUTO_REDIRECT_SECS} onComplete={() => router.replace('/')} />.
            </p>

            <button
              type="button"
              onClick={() => router.replace('/')}
              className={cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2',
                'w-full h-12 rounded-xl bg-linear-to-r from-green-700 to-green-500 hover:from-green-800 hover:to-green-600 text-white font-semibold shadow-lg shadow-green-600/25 transition-all mt-8',
              )}
            >
              <span className="flex items-center gap-2">
                Sign In Now
                <ArrowRight className="w-4 h-4" />
              </span>
            </button>
          </div>
        );

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
              This unlock link is invalid or has expired. Your account will unlock automatically
              after the lockout period, or you can wait and try signing in again.
            </p>

            <Link
              href="/"
              className="w-full h-12 rounded-xl bg-linear-to-r from-green-700 to-green-500 hover:from-green-800 hover:to-green-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-green-600/25 transition-all text-sm"
            >
              Back to Sign In
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <div className="relative mx-auto mb-8 w-20 h-20">
              <div className="w-20 h-20 bg-linear-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/30">
                <XCircle className="w-10 h-10 text-white" strokeWidth={1.75} />
              </div>
            </div>

            <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
              Could not unlock account
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed">
              {errorMessage || 'Something went wrong. Please try again or wait for the lockout to expire.'}
            </p>

            <div className="flex flex-col gap-3">
              {token && (
                <button
                  type="button"
                  onClick={() => {
                    hasAttempted.current = false;
                    setState('unlocking');
                    unlockWithToken(token);
                  }}
                  className="w-full h-12 rounded-xl bg-linear-to-r from-green-700 to-green-500 hover:from-green-800 hover:to-green-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-green-600/25 transition-all text-sm"
                >
                  Try Again
                </button>
              )}
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

  return (
    <>
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
        strategy="lazyOnload"
        onReady={() => setRecaptchaReady(true)}
      />

      <style>{`.grecaptcha-badge { visibility: hidden !important; }`}</style>

      <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(22,163,74,0.07)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute top-24 right-0 w-120 h-120 bg-green-500/5 rounded-full blur-[120px] pointer-events-none" />

        <main className="relative z-10 flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 py-16">
          <div className="w-full max-w-md">
            {(state === 'confirm' || state === 'submitting') && (
              <div className="flex justify-center mb-6">
                <Link href="/" className="flex items-center gap-3 group">
                  <div className="relative">
                    <div className="w-12 h-12 bg-linear-to-br from-emerald-500/20 to-green-500/20 ring-1 ring-emerald-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/10 border border-slate-100 dark:border-slate-800">
                      <Wallet className="h-8 w-8 text-emerald-700" strokeWidth={2} aria-hidden="true" />
                    </div>
                  </div>
                  <span className="font-bold text-2xl text-slate-900 dark:text-white tracking-tight">
                    EaziWage
                  </span>
                </Link>
              </div>
            )}

            {renderContent()}

            {(state === 'confirm' || state === 'submitting') && (
              <div className="mt-6 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-400">
                  Protected by reCAPTCHA
                </span>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
