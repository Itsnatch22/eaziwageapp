'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MfaChallengePage() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [code, setCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchFactors() {
      try {
        const res = await fetch('/api/auth/mfa-challenge');
        if (res.ok) {
          const data = await res.json();
          const totp = Array.isArray(data.factors) ? data.factors.find((f: { factor_type: string }) => f.factor_type === 'totp') : null;
          setFactorId(totp?.id ?? null);
        }
      } finally {
        setLoadingFactors(false);
      }
    }
    fetchFactors();
  }, []);

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/mfa-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', factorId, code }),
      });
      if (res.ok) {
        window.location.href = '/';
      } else {
        const err = await res.json();
        toast.error(err.error || 'Invalid verification code');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyBackupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupCode.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/mfa-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_backup_code', code: backupCode.trim() }),
      });
      if (res.ok) {
        window.location.href = '/';
      } else {
        const err = await res.json();
        toast.error(err.error || 'Invalid or already-used backup code');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Two-Factor Verification</h1>
            <p className="text-sm text-slate-500">Confirm it&apos;s you before continuing</p>
          </div>
        </div>

        {loadingFactors ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : !useBackupCode ? (
          <form onSubmit={handleVerifyTotp} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Enter the 6-digit code from your authenticator app
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-4 py-2.5 text-center text-lg tracking-widest font-mono"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={submitting || code.length !== 6 || !factorId}
              className="w-full inline-flex items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white h-11 font-medium transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => setUseBackupCode(true)}
              className="w-full text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              Use a backup code instead
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyBackupCode} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Enter one of your backup codes
              </label>
              <input
                type="text"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
                placeholder="XXXXXXXXXX"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-4 py-2.5 text-center text-lg tracking-widest font-mono uppercase"
                autoFocus
              />
              <p className="text-xs text-slate-500">Each backup code can only be used once.</p>
            </div>
            <button
              type="submit"
              disabled={submitting || !backupCode.trim()}
              className="w-full inline-flex items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white h-11 font-medium transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => setUseBackupCode(false)}
              className="w-full text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              Use authenticator app instead
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
