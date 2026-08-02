"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { Landmark, CheckCircle2, XCircle, Loader2, FileText, Clock, AlertCircle, Search, ShieldCheck, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, cn } from '@/lib/utils';
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
  const searchParams = useSearchParams();
  const targetPaymentMethodId = searchParams.get('pm');

  const [activeTab, setActiveTab] = useState<'pending' | 'verified'>('pending');
  const [methods, setMethods] = useState<PendingMethod[]>([]);
  const [verifiedMethods, setVerifiedMethods] = useState<PendingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingVerified, setLoadingVerified] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [verifiedPage, setVerifiedPage] = useState<number>(1);
  const [perPage] = useState<number>(25);
  const [total, setTotal] = useState<number>(0);
  const [verifiedTotal, setVerifiedTotal] = useState<number>(0);
  const [q, setQ] = useState<string>('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkActing, setBulkActing] = useState(false);

  const fetchPendingMethods = useCallback(async (pageNum = page, query = q) => {
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

  const fetchVerifiedMethods = useCallback(async (pageNum = verifiedPage, query = q) => {
    setLoadingVerified(true);
    try {
      const url = new URL('/api/admin/payment-methods/verified', window.location.origin);
      url.searchParams.set('page', String(pageNum));
      url.searchParams.set('per_page', String(perPage));
      if (query) url.searchParams.set('q', query);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load verified verifications');
      setVerifiedMethods(data.methods ?? []);
      setVerifiedTotal(data.meta?.total ?? 0);
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to load verified verifications');
    } finally {
      setLoadingVerified(false);
    }
  }, [perPage, q, verifiedPage]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      if (activeTab === 'pending') {
        void fetchPendingMethods(page, q);
      } else {
        void fetchVerifiedMethods(verifiedPage, q);
      }
    });
  }, [activeTab, page, verifiedPage, q, fetchPendingMethods, fetchVerifiedMethods]);

  useRealtimeRefresh(
    [{ table: 'payment_methods' }],
    () => {
      if (activeTab === 'pending') {
        void fetchPendingMethods(page, q);
      } else {
        void fetchVerifiedMethods(verifiedPage, q);
      }
    },
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
      if (status === 'approved') {
        setMethods((prev) => prev.filter((m) => m.id !== id));
      } else {
        setMethods((prev) => prev.filter((m) => m.id !== id));
      }
      if (activeTab === 'pending') {
        void fetchPendingMethods(page, q);
      } else {
        void fetchVerifiedMethods(verifiedPage, q);
      }
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
      if (activeTab === 'pending') {
        void fetchPendingMethods(page, q);
      } else {
        void fetchVerifiedMethods(verifiedPage, q);
      }
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
      if (activeTab === 'pending') {
        void fetchPendingMethods(page, q);
      } else {
        void fetchVerifiedMethods(verifiedPage, q);
      }
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
    if (activeTab === 'pending') {
      setPage(1);
      void fetchPendingMethods(1, q);
    } else {
      setVerifiedPage(1);
      void fetchVerifiedMethods(1, q);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const verifiedPages = Math.max(1, Math.ceil(verifiedTotal / perPage));

  const renderList = (items: PendingMethod[], isVerified: boolean) => {
    const currentPage = isVerified ? verifiedPage : page;
    const pageCount = isVerified ? verifiedPages : totalPages;
    const setCurrentPage = isVerified ? setVerifiedPage : setPage;
    const loadingState = isVerified ? loadingVerified : loading;
    const emptyTitle = isVerified ? 'No verified bank verifications' : 'No pending bank verifications';
    const emptyDescription = isVerified
      ? 'Approved bank accounts will appear here for quick follow-up.'
      : 'Nothing to review right now.';

    if (loadingState) {
      return (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 text-center py-16 px-4">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            {isVerified ? <ShieldCheck className="w-8 h-8 text-emerald-500" /> : <Landmark className="w-8 h-8 text-slate-400" />}
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white">{emptyTitle}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{emptyDescription}</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {targetPaymentMethodId && (
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900 dark:text-blue-300">Verification Details</p>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">Showing bank account verification details from the notification. Review and approve or reject below.</p>
            </div>
          </div>
        )}
        {items.map((m) => (
          <div
            key={m.id}
            className={cn(
              'bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30 transition-all shadow-sm',
              targetPaymentMethodId === m.id && 'ring-2 ring-blue-500 border-blue-500/50',
            )}
          >
            {targetPaymentMethodId === m.id && (
              <div className="mb-3 pb-3 border-b border-blue-200 dark:border-blue-500/30">
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold">
                  <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></span>
                  From Notification
                </span>
              </div>
            )}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                {!isVerified && (
                  <input type="checkbox" checked={!!selected[m.id]} onChange={() => toggleSelect(m.id)} className="mt-2 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
                )}
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', isVerified ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-purple-50 dark:bg-purple-500/10 text-purple-600')}>
                  {isVerified ? <ShieldCheck className="w-6 h-6" /> : <Landmark className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900 dark:text-white">{m.employee_name}</p>
                    {isVerified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {m.provider_name}{m.account_name ? ` · ${m.account_name}` : ''}
                  </p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" /> {isVerified ? 'Verified' : 'Submitted'} {formatDateTime(m.updated_at)}
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

              {!isVerified && (
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
              )}
            </div>

            {rejectingId === m.id && !isVerified && (
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
          <div className="text-sm text-slate-500">Page {currentPage} of {pageCount}</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))} disabled={currentPage === 1}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <Button size="sm" onClick={() => setCurrentPage((p: number) => Math.min(pageCount, p + 1))} disabled={currentPage === pageCount}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-linear-to-br from-slate-50 via-white to-slate-100/80 p-6 shadow-sm dark:border-slate-700/50 dark:from-slate-900/70 dark:via-slate-900 dark:to-slate-800/70">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Sparkles className="h-4 w-4" /> Bank account review hub
            </div>
            <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">Bank Account Verifications</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Review uploaded proof of ownership, approve trusted accounts, and keep a record of already verified bank accounts.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
            <div className="font-semibold text-slate-900 dark:text-white">{total} pending</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{verifiedTotal} verified</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70 lg:flex-row lg:items-center lg:justify-between">
        <form onSubmit={onSearch} className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 sm:min-w-[320px]">
            <Search className="h-4 w-4" />
            <input
              className="w-full border-0 bg-transparent outline-none placeholder:text-slate-400"
              placeholder="Search provider or account"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <Button type="submit" size="sm" className="h-10 px-4">Search</Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={selectAllOnPage} disabled={activeTab !== 'pending'}>Select page</Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
          <Button size="sm" onClick={bulkApprove} disabled={bulkActing || activeTab !== 'pending'}>{bulkActing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve Selected'}</Button>
          <Button size="sm" className="bg-red-600 text-white hover:bg-red-700" onClick={bulkReject} disabled={bulkActing || activeTab !== 'pending'}>{bulkActing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reject Selected'}</Button>
        </div>
      </div>

      <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white/80 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <button
          type="button"
          onClick={() => {
            setActiveTab('pending');
            setPage(1);
          }}
          className={cn(
            'flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
            activeTab === 'pending' ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
          )}
        >
          Pending review
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('verified');
            setVerifiedPage(1);
          }}
          className={cn(
            'flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
            activeTab === 'verified' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
          )}
        >
          Verified
        </button>
      </div>

      {activeTab === 'pending' ? renderList(methods, false) : renderList(verifiedMethods, true)}
    </div>
  );
}
