"use client";

import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface GuideStep {
  title: string;
  description: string;
  emoji: string;
}

const STEPS: Record<'admin' | 'employer' | 'employee', GuideStep[]> = {
  admin: [
    {
      emoji: '👋',
      title: 'Welcome, Admin',
      description: "You have full control over the EaziWage platform. This tour covers the five areas you'll work in daily.",
    },
    {
      emoji: '🏢',
      title: 'Employer Management',
      description: 'Review employer applications, approve KYC documents, adjust risk scores, and fund employer wallets from the Admin Wallet.',
    },
    {
      emoji: '👥',
      title: 'Employee Oversight',
      description: 'Monitor all employees across all employers — track KYC status, advance history, and flag suspicious activity from one place.',
    },
    {
      emoji: '📋',
      title: 'Review Requests',
      description: 'KYC reviews, risk assessments, and bank change requests all land in one queue. Review and respond without switching pages.',
    },
    {
      emoji: '💰',
      title: 'Reconciliation',
      description: 'Track every disbursement and recoupment. Use the reconciliation report to match employer payroll deductions at month-end.',
    },
    {
      emoji: '📊',
      title: 'Reporting',
      description: 'Generate detailed reports on employer performance, employee activity, and platform usage.',
    },
    {
      emoji: '⚙️',
      title: 'Settings',
      description: 'Configure platform settings, manage admin users, and set up notifications and alerts.',
    }
  ],
  employer: [
    {
      emoji: '🎉',
      title: "You're approved!",
      description: "Your account is live on EaziWage. Here's a quick look at how to get your team set up and running.",
    },
    {
      emoji: '📊',
      title: 'Your Dashboard',
      description: 'The overview shows your wallet balance, total employees, pending advance requests, and real-time activity as it happens.',
    },
    {
      emoji: '👥',
      title: 'Add Your Team',
      description: 'Go to Employees → Add Employee. Each staff member signs up using your company code and completes their own KYC.',
    },
    {
      emoji: '✅',
      title: 'Approve Advances',
      description: "When an employee requests an advance, you'll get notified. Review and approve directly from your dashboard — no back-and-forth.",
    },
    {
      emoji: '💳',
      title: 'Fund Your Wallet',
      description: 'Request a top-up from the admin when your balance runs low. Employees can only draw from your available wallet balance.',
    },
  ],
  employee: [
    {
      emoji: '🎉',
      title: "You're all set!",
      description: "Your account is approved and ready. Here's how to make the most of EaziWage.",
    },
    {
      emoji: '📱',
      title: 'Set Up Payment Methods',
      description: 'Add your M-Pesa number or bank account under Settings so you are ready to receive funds the moment a request is approved.',
    },
    {
      emoji: '💸',
      title: 'Request an Advance',
      description: 'Tap "Request Advance" to access up to 50% of your earned wages. Funds go directly to your M-Pesa or bank account.',
    },
    {
      emoji: '📋',
      title: 'Track Your Activity',
      description: 'Your dashboard shows every advance request, disbursement, and repayment — all in one place with full history.',
    },
    {
      emoji: '📈',
      title: 'Your Advance Limit',
      description: 'Your limit is based on your salary and what you have earned so far this pay cycle. It resets automatically on payday.',
    },
  ],
};

const storageKey = (role: string, userId: string) => `eaziwage_guide_${role}_${userId}`;

interface UserOnboardingGuideProps {
  role: 'admin' | 'employer' | 'employee';
  /** For employer/employee: only render after onboarding is approved */
  show?: boolean;
}

export function UserOnboardingGuide({ role, show = true }: UserOnboardingGuideProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId || !show) return;
    const key = storageKey(role, userId);
    if (!localStorage.getItem(key)) Promise.resolve().then(() => setVisible(true));
  }, [userId, role, show]);

  const dismiss = (finished = false) => {
    if (userId) localStorage.setItem(storageKey(role, userId), finished ? 'completed' : 'skipped');
    setVisible(false);
  };

  if (!visible) return null;

  const steps = STEPS[role];
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={() => dismiss(false)} />

      <div className="fixed bottom-6 right-6 z-50 w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700/50 overflow-hidden">

          {/* Progress bar */}
          <div className="h-1 bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-linear-to-r from-purple-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              Getting started
            </span>
            <button
              onClick={() => dismiss(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close guide"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Steps list — the "table" showing all steps */}
          <div className="px-5 pb-3">
            <div className="space-y-1">
              {steps.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all text-sm',
                    i === step
                      ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300'
                      : i < step
                      ? 'text-slate-400 dark:text-slate-500'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                  )}
                >
                  <span className="shrink-0">
                    {i < step ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <span
                        className={cn(
                          'w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px] font-bold',
                          i === step
                            ? 'border-purple-500 bg-purple-500 text-white'
                            : 'border-slate-300 dark:border-slate-600 text-slate-400',
                        )}
                      >
                        {i + 1}
                      </span>
                    )}
                  </span>
                  <span className={cn('font-medium', i === step && 'text-purple-700 dark:text-purple-300')}>
                    {s.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Current step content */}
          <div className="mx-5 mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div className="text-2xl mb-2">{current.emoji}</div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {current.description}
            </p>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 flex items-center justify-between">
            <button
              onClick={() => dismiss(false)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button size="sm" variant="outline" onClick={() => setStep(s => s - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
              {isLast ? (
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4"
                  onClick={() => dismiss(true)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Done
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4"
                  onClick={() => setStep(s => s + 1)}
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
