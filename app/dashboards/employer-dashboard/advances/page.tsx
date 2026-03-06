"use client";

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  CheckCircle2,
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

export default function EmployerAdvancesPage() {
  const [advances, setAdvances] = useState<AdvanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'approved' | 'disbursed' | 'rejected'>('');
  const [employer, setEmployer] = useState<EmployerProfile | null>(null);

  const fetchAdvances = async () => {
    const res = await fetch('/api/employer-dashboard/advances');
    const data: unknown = await res.json();
    if (!res.ok) {
      throw new Error((data as { error?: string })?.error || 'Failed to load advances');
    }
    setAdvances(Array.isArray(data) ? (data as AdvanceItem[]) : []);
  };

  useEffect(() => {
    const boot = async () => {
      try {
        const [advancesRes, employerRes] = await Promise.all([
          fetch('/api/employer-dashboard/advances'),
          fetch('/api/employer-dashboard/profile'),
        ]);

        const advancesData: unknown = await advancesRes.json();
        const employerData: EmployerData = await employerRes.json();

        if (!advancesRes.ok) throw new Error((advancesData as { error?: string })?.error || 'Failed to load advances');
        setAdvances(Array.isArray(advancesData) ? (advancesData as AdvanceItem[]) : []);
        setEmployer(
          employerData?.profile
            ? {
                company_name: employerData.profile.company_name || 'Employer',
                currency: employerData.profile.currency,
              }
            : null,
        );
      } catch (error: unknown) {
        toast.error((error as Error)?.message || 'Failed to load advances');
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, []);

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

      toast.success(action === 'approve' ? 'Advance approved' : 'Advance rejected');
      await fetchAdvances();
    } catch (error: unknown) {
      toast.error((error as Error)?.message || 'Action failed');
    } finally {
      setActingId(null);
    }
  };

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

  const stats = useMemo(() => {
    const pending = advances.filter((a) => a.status === 'pending');
    const approved = advances.filter((a) => a.status === 'approved' || a.status === 'disbursed');
    return {
      total: advances.length,
      totalAmount: advances.reduce((sum, a) => sum + Number(a.amount || 0), 0),
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, a) => sum + Number(a.amount || 0), 0),
      approvedCount: approved.length,
      avgFee:
        advances.length > 0
          ? (
              advances.reduce((sum, a) => sum + Number(a.fee_percentage || 0), 0) / advances.length
            ).toFixed(2)
          : '0.00',
    };
  }, [advances]);

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
            subtext={formatCurrency(stats.totalAmount, employer?.currency)}
            valueColor="text-primary"
          />
          <MetricCard
            icon={Clock}
            label="Pending Review"
            value={stats.pendingCount}
            subtext={formatCurrency(stats.pendingAmount, employer?.currency)}
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
            value={`${stats.avgFee}%`}
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
                        {formatCurrency(advance.amount, employer?.currency)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Fee: {advance.fee_percentage ?? 0}% ({formatCurrency(advance.fee_amount || 0, employer?.currency)})
                      </p>
                    </div>

                    <div className="text-left xl:text-right">
                      <p className="font-semibold text-primary">{formatCurrency(advance.net_amount || 0, employer?.currency)}</p>
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
        </div>
      </div>
    </EmployerPortalLayout>
  );
}


