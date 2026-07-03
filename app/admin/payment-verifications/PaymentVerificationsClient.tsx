"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { Landmark, CheckCircle2, XCircle, Loader2, FileText, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';

interface PendingMethod {
  id: string;
  employee_id: string;
  employee_name: string;
  provider_name: string;
  account_name: string | null;
  verification_status: string;
  verification_notes: string | null;
  document_url: string | null;
  created_at: string;
  updated_at: string;
}

export default function PaymentVerificationsClient() {
  const [methods, setMethods] = useState<PendingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const fetchMethods = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payment-methods/pending-review');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load pending verifications');
      setMethods(data.methods ?? []);
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to load pending verifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMethods();
  }, [fetchMethods]);

  useRealtimeRefresh(
    [{ table: 'payment_methods' }],
    () => void fetchMethods(),
  );

  const review = async (id: string, status: 'approved' | 'rejected') => {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/payment-methods/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes: status === 'rejected' ? rejectNotes[id] : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to submit review');

      toast.success(status === 'approved' ? 'Bank account approved' : 'Bank account rejected');
      setRejectingId(null);
      setMethods((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to submit review');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bank Account Verifications</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Employees requesting to use a bank account for disbursement — review the uploaded proof of ownership before approving.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : methods.length === 0 ? (
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 text-center py-16 px-4">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Landmark className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white">No pending bank verifications</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Nothing to review right now.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {methods.map((m) => (
            <div
              key={m.id}
              className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                    <Landmark className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{m.employee_name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {m.provider_name}{m.account_name ? ` · ${m.account_name}` : ''}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" /> Submitted {formatDateTime(m.updated_at)}
                    </p>
                    {m.document_url ? (
                      <a
                        href={m.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-primary hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" /> View uploaded document
                      </a>
                    ) : (
                      <p className="text-xs text-red-500 mt-2">No document on file</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-start">
                  <Button
                    size="sm"
                    onClick={() => review(m.id, 'approved')}
                    disabled={actingId === m.id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRejectingId(rejectingId === m.id ? null : m.id)}
                    disabled={actingId === m.id}
                    className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              </div>

              {rejectingId === m.id && (
                <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/30 space-y-2">
                  <Textarea
                    placeholder="Reason for rejection (shown to the employee)"
                    value={rejectNotes[m.id] ?? ''}
                    onChange={(e) => setRejectNotes((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    className="text-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setRejectingId(null)}>Cancel</Button>
                    <Button
                      size="sm"
                      onClick={() => review(m.id, 'rejected')}
                      disabled={actingId === m.id || !rejectNotes[m.id]?.trim()}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {actingId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Rejection'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
