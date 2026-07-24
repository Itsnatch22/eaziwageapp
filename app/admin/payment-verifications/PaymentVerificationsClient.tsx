"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { Landmark, CheckCircle2, XCircle, Loader2, FileText, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';

interface VerificationMetadata {
  filename?: string | null;
  content_type?: string | null;
  checksum?: string | null;
  scan_status?: string | null;
}

interface PendingMethod {
  id: string;
  employee_id: string;
  employee_name: string;
  provider_name: string;
  account_name: string | null;
  verification_status: string;
  verification_notes: string | null;
  document_url: string | null;
  verification_metadata?: VerificationMetadata | null;
  verification_document_hash?: string | null;
  created_at: string;
  updated_at: string;
}

export default function PaymentVerificationsClient() {
  const [methods, setMethods] = useState<PendingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [perPage] = useState<number>(25);
  const [total, setTotal] = useState<number>(0);
  const [q, setQ] = useState<string>('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkActing, setBulkActing] = useState(false);

  const fetchMethods = useCallback(async (pageNum = page, query = q) => {
    setLoading(true);
    try {
      const url = new URL('/api/admin/payment-methods/pending-review', window.location.origin);
      url.searchParams.set('page', String(pageNum));
      url.searchParams.set('per_page', String(perPage));
      if (query) url.searchParams.set('q', query);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load pending verifications');
      setMethods(data.methods ?? []);
      setTotal(data.meta?.total ?? 0);
      setSelected({});
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to load pending verifications');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, q]);

  useEffect(() => {
    // Schedule the fetch asynchronously to avoid synchronous setState within the effect
    void Promise.resolve().then(() => fetchMethods(page, q));
    // include fetchMethods and q in deps to ensure freshness
  }, [page, q, fetchMethods]);

  useRealtimeRefresh(
    [{ table: 'payment_methods' }],
    () => void fetchMethods(page, q),
  );

  const review = async (id: string, status: 'approved' | 'rejected', note?: string) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/payment-methods/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes: status === 'rejected' ? (note ?? rejectNotes[id]) : undefined }),
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

  const bulkApprove = async () => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (ids.length === 0) return toast.error('No items selected');
    setBulkActing(true);
    try {
      await Promise.all(ids.map((id) => fetch(`/api/admin/payment-methods/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })));
      toast.success(`Approved ${ids.length} payment method(s)`);
      void fetchMethods(page, q);
    } catch (err) {
      toast.error((err as Error)?.message || 'Bulk approve failed');
    } finally {
      setBulkActing(false);
    }
  };

  const bulkReject = async () => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (ids.length === 0) return toast.error('No items selected');
    const reason = window.prompt('Reason for rejection (this will be shown to the employee):');
    if (!reason || !reason.trim()) return toast.error('Rejection reason is required');
    setBulkActing(true);
    try {
      await Promise.all(ids.map((id) => fetch(`/api/admin/payment-methods/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', notes: reason }),
      })));
      toast.success(`Rejected ${ids.length} payment method(s)`);
      void fetchMethods(page, q);
    } catch (err) {
      toast.error((err as Error)?.message || 'Bulk reject failed');
    } finally {
      setBulkActing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectAllOnPage = () => {
    const all: Record<string, boolean> = {};
    methods.forEach((m) => { all[m.id] = true; });
    setSelected(all);
  };

  const clearSelection = () => setSelected({});

  const onSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setPage(1);
    void fetchMethods(1, q);
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bank Account Verifications</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Employees requesting to use a bank account for disbursement — review the uploaded proof of ownership before approving.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <form onSubmit={onSearch} className="flex items-center gap-2">
          <input
            className="input"
            placeholder="Search provider or account"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button type="submit" size="sm">Search</Button>
        </form>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={selectAllOnPage}>Select page</Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
          <Button size="sm" onClick={bulkApprove} disabled={bulkActing}>{bulkActing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve Selected'}</Button>
          <Button size="sm" className="bg-red-600 text-white" onClick={bulkReject} disabled={bulkActing}>{bulkActing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reject Selected'}</Button>
        </div>
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
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <input type="checkbox" checked={!!selected[m.id]} onChange={() => toggleSelect(m.id)} className="mt-2" />
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

                    {m.verification_metadata && (
                      <p className="text-xs text-slate-500 mt-2">Checksum: {m.verification_metadata.checksum ?? m.verification_document_hash ?? '—'} · Scan: {m.verification_metadata.scan_status ?? 'unknown'}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start">
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

          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">Page {page} of {totalPages}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
              <Button size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
