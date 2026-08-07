"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import {
  Landmark,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Clock,
  AlertCircle,
  Search,
  ShieldCheck,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  X,
  ExternalLink,
  ShieldAlert,
  Hash,
  FileSearch
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CardGridSkeleton } from '@/components/shared/Skeletons';

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

type GradientVariant = 'purple' | 'green' | 'amber' | 'red' | 'blue';
type IconType = React.ComponentType<{ className?: string }>;

interface GradientIconBoxProps {
  icon: IconType;
  size?: 'sm' | 'md' | 'lg';
  variant?: GradientVariant;
}

const GradientIconBox = ({ icon: Icon, size = 'md', variant = 'purple' }: GradientIconBoxProps) => {
  const sizes = { sm: 'w-10 h-10', md: 'w-12 h-12', lg: 'w-14 h-14' };
  const iconSizes = { sm: 'w-5 h-5', md: 'w-6 h-6', lg: 'w-7 h-7' };
  const variants = {
    purple: 'from-purple-600 to-purple-700',
    green: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
    blue: 'from-blue-500 to-blue-600',
  };

  return (
    <div className={cn('rounded-xl flex items-center justify-center bg-linear-to-br shadow-lg', sizes[size], variants[variant])}>
      <Icon className={cn('text-white', iconSizes[size])} />
    </div>
  );
};

interface MetricCardProps {
  icon: IconType;
  label: string;
  value: number | string;
  subtext?: string;
  variant?: GradientVariant;
  onClick?: () => void;
  active?: boolean;
}

const MetricCard = ({ icon, label, value, subtext, variant = 'purple', onClick, active }: MetricCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'w-full text-left bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border transition-all duration-200 shadow-xs hover:shadow-md',
      active
        ? 'border-purple-500/80 ring-2 ring-purple-500/20 dark:border-purple-500/80'
        : 'border-slate-200/60 dark:border-slate-700/40 hover:border-slate-300 dark:hover:border-slate-600'
    )}
  >
    <div className="flex items-start justify-between">
      <GradientIconBox icon={icon} size="md" variant={variant} />
    </div>
    <div className="mt-4">
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</p>
      {subtext && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtext}</p>}
    </div>
  </button>
);

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

  // Document Modal Preview State
  const [previewMethod, setPreviewMethod] = useState<PendingMethod | null>(null);

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

  const refreshAll = useCallback(() => {
    if (activeTab === 'pending') {
      void fetchPendingMethods(page, q);
    } else {
      void fetchVerifiedMethods(verifiedPage, q);
    }
  }, [activeTab, page, verifiedPage, q, fetchPendingMethods, fetchVerifiedMethods]);

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
      refreshAll();
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

      toast.success(status === 'approved' ? 'Bank account approved successfully' : 'Bank account rejected');
      setRejectingId(null);
      if (previewMethod?.id === id) setPreviewMethod(null);

      setMethods((prev) => prev.filter((m) => m.id !== id));
      refreshAll();
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to submit review');
    } finally {
      setActingId(null);
    }
  };

  const selectedCount = Object.keys(selected).filter((k) => selected[k]).length;

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
      refreshAll();
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
      refreshAll();
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
    const emptyTitle = isVerified ? 'No verified bank accounts' : 'No pending bank verifications';
    const emptyDescription = isVerified
      ? 'Approved employee bank accounts will appear here for audit history.'
      : 'All submitted bank accounts have been reviewed.';

    if (loadingState) {
      return <CardGridSkeleton count={4} />;
    }

    if (items.length === 0) {
      return (
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-700/40 text-center py-16 px-4 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            {isVerified ? <ShieldCheck className="w-8 h-8 text-emerald-500" /> : <Landmark className="w-8 h-8 text-slate-400" />}
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-base">{emptyTitle}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">{emptyDescription}</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {targetPaymentMethodId && (
          <div className="bg-blue-50/90 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900 dark:text-blue-300">Targeted Notification Review</p>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-0.5">
                Displaying bank account verification linked from notification system. Highlighted below.
              </p>
            </div>
          </div>
        )}

        {items.map((m) => (
          <div
            key={m.id}
            className={cn(
              'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-5 border border-slate-200/60 dark:border-slate-700/40 transition-all shadow-xs hover:shadow-md',
              targetPaymentMethodId === m.id && 'ring-2 ring-blue-500 border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/20'
            )}
          >
            {targetPaymentMethodId === m.id && (
              <div className="mb-3 pb-3 border-b border-blue-200 dark:border-blue-500/30 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold">
                  <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse"></span>
                  From Notification Alert
                </span>
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                {!isVerified && (
                  <input
                    type="checkbox"
                    checked={!!selected[m.id]}
                    onChange={() => toggleSelect(m.id)}
                    className="mt-2 h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                )}

                <GradientIconBox
                  icon={isVerified ? ShieldCheck : Landmark}
                  size="md"
                  variant={isVerified ? 'green' : 'purple'}
                />

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-slate-900 dark:text-white text-base">{m.employee_name}</h4>
                    {isVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                        <Clock className="w-3.5 h-3.5" /> Pending Review
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {m.provider_name} {m.account_name ? `· ${m.account_name}` : ''}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {isVerified ? 'Verified' : 'Submitted'}: {formatDateTime(m.updated_at)}
                    </span>

                    {m.verification_metadata?.checksum && (
                      <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Hash className="w-3.5 h-3.5" />
                        Checksum: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">{m.verification_metadata.checksum.slice(0, 10)}...</code>
                      </span>
                    )}
                  </div>

                  {m.document_url ? (
                    <div className="pt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPreviewMethod(m)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 bg-purple-50 dark:bg-purple-500/10 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> Preview Document
                      </button>
                      <a
                        href={m.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        <ExternalLink className="w-3 h-3" /> Direct Link
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1 pt-1 font-medium">
                      <ShieldAlert className="w-3.5 h-3.5" /> No ownership proof document attached
                    </p>
                  )}
                </div>
              </div>

              {!isVerified && (
                <div className="flex items-center gap-2 self-start pt-2 md:pt-0">
                  <Button
                    size="sm"
                    onClick={() => review(m.id, 'approved')}
                    disabled={actingId === m.id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                  >
                    {actingId === m.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                    Approve
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRejectingId(rejectingId === m.id ? null : m.id)}
                    disabled={actingId === m.id}
                    className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40 font-medium"
                  >
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </div>

            {rejectingId === m.id && !isVerified && (
              <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/40 space-y-3 bg-red-50/40 dark:bg-red-950/20 p-4 rounded-xl">
                <label className="block text-xs font-semibold text-red-800 dark:text-red-300">
                  Reason for Rejection (visible to employee)
                </label>
                <Textarea
                  placeholder="e.g. Bank statement name does not match profile name, or document is unreadable."
                  value={rejectNotes[m.id] ?? ''}
                  onChange={(e) => setRejectNotes((prev) => ({ ...prev, [m.id]: e.target.value }))}
                  className="text-sm bg-white dark:bg-slate-900 border-red-200 dark:border-red-900/50"
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setRejectingId(null)}>Cancel</Button>
                  <Button
                    size="sm"
                    onClick={() => review(m.id, 'rejected')}
                    disabled={actingId === m.id || !rejectNotes[m.id]?.trim()}
                    className="bg-red-600 hover:bg-red-700 text-white font-medium"
                  >
                    {actingId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Rejection'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Showing Page {currentPage} of {pageCount} ({isVerified ? verifiedTotal : total} total)
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 text-xs font-medium"
            >
              <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage((p: number) => Math.min(pageCount, p + 1))}
              disabled={currentPage === pageCount}
              className="h-8 text-xs font-medium"
            >
              Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="rounded-3xl border border-slate-200/70 bg-linear-to-br from-slate-50 via-white to-slate-100/80 p-6 shadow-xs dark:border-slate-700/50 dark:from-slate-900/80 dark:via-slate-900 dark:to-slate-800/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300">
              <Sparkles className="h-3.5 w-3.5" /> Financial Security & Verification Hub
            </div>
            <h1 className="mt-3 text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Bank Account Verifications
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Verify proof of ownership for employee bank accounts, audit document integrity, and approve secure payout channels.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              className="h-9 gap-1.5 font-medium border-slate-200 dark:border-slate-700"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Clock}
          label="Pending Verifications"
          value={total}
          subtext="Requires admin review"
          variant="amber"
          active={activeTab === 'pending'}
          onClick={() => { setActiveTab('pending'); setPage(1); }}
        />
        <MetricCard
          icon={ShieldCheck}
          label="Verified Accounts"
          value={verifiedTotal}
          subtext="Approved for payouts"
          variant="green"
          active={activeTab === 'verified'}
          onClick={() => { setActiveTab('verified'); setVerifiedPage(1); }}
        />
        <MetricCard
          icon={FileSearch}
          label="Selected for Batch"
          value={selectedCount}
          subtext={selectedCount > 0 ? 'Ready for bulk action' : 'Check items below'}
          variant="blue"
        />
        <MetricCard
          icon={Landmark}
          label="Total Records"
          value={total + verifiedTotal}
          subtext="Accounts on file"
          variant="purple"
        />
      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-xs dark:border-slate-700/60 dark:bg-slate-900/70 lg:flex-row lg:items-center lg:justify-between">
        <form onSubmit={onSearch} className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all placeholder:text-slate-400"
              placeholder="Search employee, bank, or account..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" className="h-9 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium">
            Search
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'pending' && (
            <>
              <Button size="sm" variant="outline" onClick={selectAllOnPage} className="h-9 text-xs font-medium">
                Select Page
              </Button>
              {selectedCount > 0 && (
                <>
                  <Button size="sm" variant="ghost" onClick={clearSelection} className="h-9 text-xs">
                    Clear ({selectedCount})
                  </Button>
                  <Button
                    size="sm"
                    onClick={bulkApprove}
                    disabled={bulkActing}
                    className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  >
                    {bulkActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Approve Selected (${selectedCount})`}
                  </Button>
                  <Button
                    size="sm"
                    onClick={bulkReject}
                    disabled={bulkActing}
                    className="h-9 text-xs bg-red-600 hover:bg-red-700 text-white font-medium"
                  >
                    {bulkActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Reject Selected (${selectedCount})`}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex gap-2 rounded-2xl border border-slate-200/80 bg-white/80 p-1.5 shadow-xs dark:border-slate-700 dark:bg-slate-900/70">
        <button
          type="button"
          onClick={() => {
            setActiveTab('pending');
            setPage(1);
          }}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer',
            activeTab === 'pending'
              ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          )}
        >
          <Clock className="w-4 h-4" />
          Pending Review ({total})
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('verified');
            setVerifiedPage(1);
          }}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer',
            activeTab === 'verified'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          )}
        >
          <ShieldCheck className="w-4 h-4" />
          Verified ({verifiedTotal})
        </button>
      </div>

      {/* Main Content List */}
      {activeTab === 'pending' ? renderList(methods, false) : renderList(verifiedMethods, true)}

      {/* Document Preview Modal */}
      {previewMethod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <GradientIconBox icon={FileText} size="sm" variant="purple" />
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Proof of Ownership Document
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {previewMethod.employee_name} · {previewMethod.provider_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMethod(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/40 space-y-2">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500">Employee:</span>
                    <p className="font-semibold text-slate-900 dark:text-white">{previewMethod.employee_name}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Bank / Provider:</span>
                    <p className="font-semibold text-slate-900 dark:text-white">{previewMethod.provider_name}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Account Name:</span>
                    <p className="font-semibold text-slate-900 dark:text-white">{previewMethod.account_name ?? '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Submitted Date:</span>
                    <p className="font-semibold text-slate-900 dark:text-white">{formatDateTime(previewMethod.updated_at)}</p>
                  </div>
                </div>

                {previewMethod.verification_metadata && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/40 text-xs space-y-1">
                    <p className="text-slate-500">
                      <strong>Filename:</strong> {previewMethod.verification_metadata.filename ?? '—'}
                    </p>
                    <p className="text-slate-500">
                      <strong>Checksum:</strong> <code className="font-mono text-[11px] bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded">{previewMethod.verification_metadata.checksum ?? previewMethod.verification_document_hash ?? '—'}</code>
                    </p>
                    <p className="text-slate-500">
                      <strong>Scan Status:</strong> {previewMethod.verification_metadata.scan_status ?? 'Passed'}
                    </p>
                  </div>
                )}
              </div>

              {/* Document Viewer Frame */}
              {previewMethod.document_url ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950 flex flex-col items-center justify-center min-h-[320px]">
                  {previewMethod.document_url.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/) ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={previewMethod.document_url}
                      alt="Bank ownership document"
                      className="max-h-[450px] w-auto object-contain"
                    />
                  ) : (
                    <iframe
                      src={previewMethod.document_url}
                      title="Bank account ownership document"
                      className="w-full h-[450px] border-0"
                    />
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-2xl">
                  No document attachment available.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <a
                href={previewMethod.document_url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open in New Tab
              </a>

              <div className="flex gap-2">
                {activeTab === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => review(previewMethod.id, 'approved')}
                      disabled={actingId === previewMethod.id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRejectingId(previewMethod.id);
                        setPreviewMethod(null);
                      }}
                      disabled={actingId === previewMethod.id}
                      className="border-red-200 text-red-700 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" onClick={() => setPreviewMethod(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
