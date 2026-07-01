"use client";

import { useEffect, useMemo, useState, useCallback, type ComponentType } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Search,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmployerPortalLayout } from '@/components/employer/EmployerLayout';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { createClient } from '@/lib/supabase/client';

type AdvanceStatus = 'pending' | 'approved' | 'disbursed' | 'rejected' | 'repaid' | string;

interface AdvanceItem {
  id: string;
  employee_name: string;
  employee_code: string | null;
  amount: number;
  fee_percentage: number;
  fee_amount: number;
  net_amount: number;
  disbursement_method: string;
  status: AdvanceStatus;
  created_at: string;
}

interface MetricCardProps {
  label: string;
  value: number | string;
  subtext?: string;
  icon: ComponentType<{ className?: string }>;
  valueColor?: string;
}

interface EmployerProfile {
  company_name: string;
  currency?: string;
}

const MetricCard = ({
  label,
  value,
  subtext,
  icon: Icon,
  valueColor = 'text-slate-900 dark:text-white',
}: MetricCardProps) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30">
    <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center">
      <Icon className="w-5 h-5 text-primary" />
    </div>
    <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">{label}</p>
    <p className={cn('text-2xl font-bold mt-1', valueColor)}>{value}</p>
    {subtext ? <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtext}</p> : null}
  </div>
);

const StatusBadge = ({ status }: { status: AdvanceStatus }) => {
  const config = {
    pending: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300' },
    approved: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300' },
    disbursed: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300' },
    rejected: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300' },
    repaid: { bg: 'bg-slate-100 dark:bg-slate-700/50', text: 'text-slate-700 dark:text-slate-300' },
  };

  const state = config[status as keyof typeof config] ?? config.pending;
  return (
    <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold capitalize', state.bg, state.text)}>
      {status}
    </span>
  );
};

interface EmployerData {
  profile?: {
    company_name?: string;
    currency?: string;
  };
}

interface AdvanceStats {
  total: number;
  totalAmount: number;
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
  avgFee: number;
}

const EMPTY_STATS: AdvanceStats = {
  total: 0,
  totalAmount: 0,
  pendingCount: 0,
  pendingAmount: 0,
  approvedCount: 0,
  avgFee: 0,
};

const PAGE_SIZE = 50;

export default function EmployerAdvancesPage() {
  const { currency } = useCurrency();
  const [advances, setAdvances] = useState<AdvanceItem[]>([]);
  const [stats, setStats] = useState<AdvanceStats>(EMPTY_STATS);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'approved' | 'disbursed' | 'rejected'>('');
  const [employer, setEmployer] = useState<EmployerProfile | null>(null);
  const [employerId, setEmployerId] = useState<string | null>(null);

  const fetchAdvances = useCallback(async (pageToLoad: number) => {
    const res = await fetch(`/api/employer-dashboard/advances?page=${pageToLoad}&pageSize=${PAGE_SIZE}`);
    const data: unknown = await res.json();
    if (!res.ok) {
      throw new Error((data as { error?: string })?.error || 'Failed to load advances');
    }
    const body = data as { advances?: AdvanceItem[]; total?: number; stats?: AdvanceStats };
    setAdvances(Array.isArray(body.advances) ? body.advances : []);
    setTotal(body.total ?? 0);
    setStats(body.stats ?? EMPTY_STATS);
  }, []);

  // Scoped to this employer's advances only — UPDATE covers status changes from admin/disbursement
  useRealtimeRefresh(
    employerId ? [{ table: 'advances', event: 'UPDATE', filter: `employer_id=eq.${employerId}` }] : [],
    () => void fetchAdvances(page),
  );

  // Resolve employerId + employer profile once on mount — separate from the
  // paginated advances fetch below so switching pages doesn't re-resolve these.
  useEffect(() => {
    const boot = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: emp } = await supabase
            .from('employers')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
          setEmployerId(emp?.id ?? null);
        }

        const employerRes = await fetch('/api/employer-dashboard/profile');
        const employerData: EmployerData = await employerRes.json();
        setEmployer(
          employerData?.profile
            ? {
                company_name: employerData.profile.company_name || 'Employer',
                currency: employerData.profile.currency,
              }
            : null,
        );
      } catch (error: unknown) {
        toast.error((error as Error)?.message || 'Failed to load employer profile');
      }
    };
    boot();
  }, []);

  // Runs on mount (page 1) and again whenever the user changes page.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchAdvances(page)
      .catch((error: unknown) => toast.error((error as Error)?.message || 'Failed to load advances'))
      .finally(() => setLoading(false));
  }, [page, fetchAdvances]);

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'deny') => {
    setActingId(id);
    try {
      const res = await fetch(`/api/employer-dashboard/advances/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data: Record<string, string> = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.message || 'Action failed');

      toast.success(action === 'approve' ? 'Advance approved — processing disbursement...' : 'Advance rejected');
      await fetchAdvances(page);
    } catch (error: unknown) {
      toast.error((error as Error)?.message || 'Action failed');
    } finally {
      setActingId(null);
    }
  };

  // Search/status filtering happens client-side over the current page only
  // (the list itself is server-paginated). Jump back to page 1 whenever a
  // filter changes so results aren't scoped to whatever page was open before.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [searchTerm, statusFilter]);

  const filteredAdvances = useMemo(() => {
    return advances.filter((a) => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        a.employee_name?.toLowerCase().includes(s) ||
        (a.employee_code || '').toLowerCase().includes(s) ||
        a.id.toLowerCase().includes(s)
      );
    });
  }, [advances, searchTerm, statusFilter]);

  // stats now comes from the server (computed across the employer's full advance
  // history, not just the current page — see fetchAdvances/EMPTY_STATS above).
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <EmployerPortalLayout employer={employer}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="advances-title">
              Advance Requests
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Review, approve, reject or deny employee advance requests.
            </p>
          </div>
          <Button
            variant="outline"
            className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={CreditCard}
            label="Total Requests"
            value={stats.total}
            subtext={formatCurrency(stats.totalAmount, currency)}
            valueColor="text-primary"
          />
          <MetricCard
            icon={Clock}
            label="Pending Review"
            value={stats.pendingCount}
            subtext={formatCurrency(stats.pendingAmount, currency)}
            valueColor="text-amber-600"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Approved/Disbursed"
            value={stats.approvedCount}
            subtext="Processed requests"
            valueColor="text-emerald-600"
          />
          <MetricCard
            icon={TrendingUp}
            label="Average Fee"
            value={`${stats.avgFee.toFixed(2)}%`}
            subtext="Across all requests"
            valueColor="text-blue-600"
          />
        </div>

        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by employee, code, or request ID"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-11 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: '', label: 'All' },
                { key: 'pending', label: 'Pending' },
                { key: 'approved', label: 'Approved' },
                { key: 'disbursed', label: 'Disbursed' },
                { key: 'rejected', label: 'Rejected' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key as typeof statusFilter)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                    statusFilter === f.key
                      ? 'bg-linear-to-r from-primary to-emerald-600 text-white shadow-lg shadow-primary/25'
                      : 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : filteredAdvances.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">No advance requests found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Requests submitted by employees will appear here for review.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
              {filteredAdvances.map((advance) => {
                const canReview = advance.status === 'pending';
                return (
                  <div key={advance.id} className="p-4 flex flex-col xl:flex-row xl:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{advance.employee_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {advance.employee_code ? `Code: ${advance.employee_code} - ` : ''}
                        Request: {advance.id.slice(0, 8)}...
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {formatDateTime(advance.created_at)}
                      </p>
                    </div>

                    <div className="text-left xl:text-right">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {formatCurrency(advance.amount, currency)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Fee: {advance.fee_percentage ?? 0}% ({formatCurrency(advance.fee_amount || 0, currency)})
                      </p>
                    </div>

                    <div className="text-left xl:text-right">
                      <p className="font-semibold text-primary">{formatCurrency(advance.net_amount || 0, currency)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                        {(advance.disbursement_method || '').replace('_', ' ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusBadge status={advance.status} />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAction(advance.id, 'approve')}
                        disabled={!canReview || actingId === advance.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(advance.id, 'reject')}
                        disabled={!canReview || actingId === advance.id}
                        className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(advance.id, 'deny')}
                        disabled={!canReview || actingId === advance.id}
                      >
                        Deny
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && total > 0 && (
            <div className="flex items-center justify-between gap-4 p-4 border-t border-slate-200/50 dark:border-slate-700/30">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-slate-600 dark:text-slate-300 px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </EmployerPortalLayout>
  );
}



