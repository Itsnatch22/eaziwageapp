"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Landmark, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface Recoupment {
  id: string;
  amount_due: number;
  currency: string;
  status: 'pending_response' | 'confirmed' | 'collecting' | 'collected' | 'failed' | 'declined';
  payday_date: string;
  failure_reason: string | null;
}

// Mounted at the EmployerPortalLayout level so it surfaces on every employer
// page, not just the dashboard home — matches the intent that this isn't
// something an employer can just navigate away from.
export function PaydayRecoupmentModal() {
  const pathname = usePathname();
  const [recoupment, setRecoupment] = useState<Recoupment | null>(null);
  const [acting, setActing] = useState(false);

  const fetchRecoupment = useCallback(async () => {
    try {
      const res = await fetch('/api/employer-dashboard/payday-recoupment');
      if (!res.ok) return;
      const data = await res.json();
      setRecoupment(data.recoupment ?? null);
    } catch {
      // Silent — this is a background check, not a page-critical fetch.
    }
  }, []);

  useEffect(() => {
    if (pathname === '/dashboards/employer-dashboard/onboarding') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRecoupment();
  }, [pathname, fetchRecoupment]);

  if (!recoupment || pathname === '/dashboards/employer-dashboard/onboarding') return null;

  const handleConfirm = async () => {
    setActing(true);
    try {
      const res = await fetch(`/api/employer-dashboard/payday-recoupment/${recoupment.id}/confirm`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Recoupment initiated — check your phone to approve the request.');
        setRecoupment(data.recoupment);
      } else {
        toast.error(data?.error || 'Failed to initiate recoupment');
        await fetchRecoupment();
      }
    } catch {
      toast.error('Failed to initiate recoupment');
    } finally {
      setActing(false);
    }
  };

  const handleDecline = async () => {
    setActing(true);
    try {
      const res = await fetch(`/api/employer-dashboard/payday-recoupment/${recoupment.id}/decline`, { method: 'POST' });
      if (res.ok) {
        toast.info('Recoupment declined. This will need to be resolved before new advances can be requested.');
        setRecoupment(null);
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || 'Failed to submit response');
      }
    } catch {
      toast.error('Failed to submit response');
    } finally {
      setActing(false);
    }
  };

  const amountLabel = formatCurrency(recoupment.amount_due, recoupment.currency);

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-linear-to-br from-primary to-emerald-600 p-6 text-white">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
            <Landmark className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold">Your payday is here</h2>
        </div>

        <div className="p-6 space-y-4">
          {recoupment.status === 'collecting' ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Recoupment request sent — approve it on your phone to complete it.
              </p>
            </div>
          ) : recoupment.status === 'failed' ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800/30">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">
                  {recoupment.failure_reason || 'The recoupment request failed.'}
                </p>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Do you wish to recoup <strong>{amountLabel}</strong> back to EaziWage now?
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleDecline} disabled={acting} className="flex-1">
                  Not now
                </Button>
                <Button onClick={handleConfirm} disabled={acting} className="flex-1 bg-primary text-white">
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Retry'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Your employees have <strong>{amountLabel}</strong> in outstanding wage advances due for recoupment.
                Do you wish to recoup this amount back to EaziWage now?
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleDecline} disabled={acting} className="flex-1">
                  No
                </Button>
                <Button onClick={handleConfirm} disabled={acting} className="flex-1 bg-primary text-white">
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, recoup now'}
                </Button>
              </div>
              <p className="text-xs text-slate-400 text-center">
                Declining will flag your account until this is resolved — new employee advance requests will be paused.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
