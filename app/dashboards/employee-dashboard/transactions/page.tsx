"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { EmptyState } from '@/app/empty';
import {
  TrendingUp, AlertCircle,
  History, Smartphone, Calendar,
  Loader2, Landmark, Search, ChevronRight, CheckCircle2, Clock
} from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import { Input } from '@/components/ui/input';
import { formatCurrency, cn } from '@/lib/utils';
import { EmployeePortalLayout } from '@/components/employee/EmployeeLayout';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { createClient } from '@/lib/supabase/client';

type AdvanceStatus = 'pending' | 'processing' | 'approved' | 'disbursed' | 'completed' | 'repaid' | 'failed' | 'rejected' | 'denied' | 'fraud_review' | string;
type DisbursementMethod = 'mobile_money' | 'bank_transfer' | string;
type FilterType = 'all' | 'pending' | 'completed' | 'failed';

interface Advance {
  id: string | number;
  amount: number;
  status: AdvanceStatus;
  disbursement_method: DisbursementMethod;
  created_at: string;
}

interface TransactionItem {
  id: string | number;
  type: 'advance';
  amount: number;
  status: AdvanceStatus;
  method: DisbursementMethod;
  created_at: string;
}

interface StatusConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bg: string;
  pulse?: boolean;
}

const getStatusConfig = (status: AdvanceStatus): StatusConfig => {
  switch (status) {
    case 'disbursed':
    case 'completed':
    case 'repaid':
      return { icon: CheckCircle2, label: 'Completed', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    case 'pending':
    case 'processing':
      return { icon: Clock, label: 'Processing', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20', pulse: true };
    case 'fraud_review':
      return { icon: Clock, label: 'Under Review', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20', pulse: true };
    case 'approved':
      return { icon: CheckCircle2, label: 'Approved', color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20' };
    case 'failed':
    case 'rejected':
    case 'denied':
      return { icon: AlertCircle, label: 'Failed', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' };
    default:
      return { icon: Clock, label: status, color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' };
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function Transactions() {
  const { currency } = useCurrency();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const fetchAdvances = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const txRes = await fetch('/api/employee-dashboard/transactions');
      if (txRes.ok) {
        const txData = await txRes.json();
        setAdvances(Array.isArray(txData) ? txData : []);
      }
    } catch {
      toast.error('Failed to sync transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchAdvances({ silent: true });
      // Resolve employee ID for Realtime filter — done once after initial load
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: emp } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        setEmployeeId(emp?.id ?? null);
      }
    };
    void init();
  }, [fetchAdvances]);

  useRealtimeRefresh(
    employeeId ? [{ table: 'advances', event: 'UPDATE', filter: `employee_id=eq.${employeeId}` }] : [],
    () => void fetchAdvances({ silent: true }),
  );

  const allItems: TransactionItem[] = advances
    .map((a) => ({ id: a.id, type: 'advance' as const, amount: a.amount, status: a.status, method: a.disbursement_method, created_at: a.created_at }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const isPending = (status: AdvanceStatus) => ['pending', 'processing', 'approved', 'fraud_review'].includes(status);
  const isCompleted = (status: AdvanceStatus) => ['disbursed', 'completed', 'repaid'].includes(status);
  const isFailed = (status: AdvanceStatus) => ['failed', 'rejected', 'denied'].includes(status);

  const filteredItems = allItems.filter((item) => {
    const matchesFilter =
      filter === 'all' ? true
      : filter === 'pending' ? isPending(item.status)
      : filter === 'completed' ? isCompleted(item.status)
      : isFailed(item.status);
    const matchesSearch =
      searchTerm === '' ? true
      : item.amount.toString().includes(searchTerm) || item.status.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const currentMonth = new Date().getMonth();
  const monthlyTotal = advances
    .filter((a) => new Date(a.created_at).getMonth() === currentMonth && isCompleted(a.status))
    .reduce((sum, a) => sum + a.amount, 0);
  const totalTransactions = advances.filter((a) => isCompleted(a.status)).length;

  const filters: Array<{ id: FilterType; label: string; count: number }> = [
    { id: 'all', label: 'All', count: allItems.length },
    { id: 'pending', label: 'Pending', count: allItems.filter((i) => isPending(i.status)).length },
    { id: 'completed', label: 'Done', count: allItems.filter((i) => isCompleted(i.status)).length },
    { id: 'failed', label: 'Failed', count: allItems.filter((i) => isFailed(i.status)).length },
  ];

  return (
    <EmployeePortalLayout title="Ledger">
      <div className="max-w-4xl mx-auto space-y-6">

        
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Transaction History</p>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Recent Activity</h1>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton 
              data={filteredItems}
              filename="my-transactions"
              headers={['Date', 'Amount', 'Status', 'Method']}
              mapping={(t: TransactionItem) => [
                new Date(t.created_at).toLocaleDateString(),
                t.amount,
                t.status,
                t.method
              ]}
            />
          </div>
        </div>

        
        <div className="grid sm:grid-cols-2 gap-4">
          
          <div className="bg-slate-900 dark:bg-white/4 rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl opacity-20"
              style={{ background: '#10b981' }} />
            <div className="relative z-10">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                style={{ background: '#10b98118', border: '1px solid #10b98130' }}>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1">This Month</p>
              <p className="text-3xl font-bold text-white tabular-nums tracking-tight">
                {formatCurrency(monthlyTotal, currency).split('.')[0]}
              </p>
              <p className="text-[9px] font-semibold text-white/30 uppercase tracking-widest mt-1">Total Disbursements</p>
            </div>
          </div>

          
          <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 p-6 relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl opacity-15"
              style={{ background: '#3b82f6' }} />
            <div className="relative z-10">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                style={{ background: '#3b82f618', border: '1px solid #3b82f630' }}>
                <Calendar className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Activity Count</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
                {totalTransactions}
              </p>
              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mt-1">Successful Transactions</p>
            </div>
          </div>
        </div>

        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search amount or status…"
              className="h-11 pl-10 rounded-xl bg-white/50 dark:bg-white/3 backdrop-blur-xl border-white/60 dark:border-white/10 text-sm"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "flex items-center gap-1.5 h-11 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shrink-0 border",
                  filter === f.id
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-md"
                    : "bg-white/50 dark:bg-white/3 backdrop-blur-xl text-slate-500 border-white/60 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
                )}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-lg text-[9px] font-bold",
                    filter === f.id ? "bg-white/20 dark:bg-black/20" : "bg-slate-100 dark:bg-white/10 text-slate-400"
                  )}>{f.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        
        <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 overflow-hidden min-h-64">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Syncing ledger…</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={History}
              title="No Activity"
              description="You haven't made any advance requests yet."
              action={{
                label: "Request Funds",
                href: "/dashboards/employee-dashboard/request-advance"
              }}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredItems.map((item) => {
                const config = getStatusConfig(item.status);
                const StatusIcon = config.icon;
                return (
                  <div key={item.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/50 dark:hover:bg-white/2 transition-colors group">

                    
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                      item.method === 'mobile_money'
                        ? "border-emerald-400/20 text-emerald-500"
                        : "border-blue-400/20 text-blue-500"
                    )}
                      style={{ background: item.method === 'mobile_money' ? '#10b98110' : '#3b82f610' }}>
                      {item.method === 'mobile_money'
                        ? <Smartphone className="w-4 h-4" />
                        : <Landmark className="w-4 h-4" />}
                    </div>

                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white leading-none">Wage Advance</p>
                        {config.pulse && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 uppercase tracking-wider">
                        {formatDate(item.created_at)} · {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    
                    <div className="text-right shrink-0">
                      <p className={cn(
                        "text-sm font-bold tabular-nums tracking-tight",
                        isFailed(item.status) ? "text-slate-300 dark:text-white/20 line-through" : "text-slate-900 dark:text-white"
                      )}>
                        {formatCurrency(item.amount, currency).split('.')[0]}
                      </p>
                      <div className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border mt-1",
                        config.bg, config.color
                      )}>
                        <StatusIcon className="w-2.5 h-2.5" />
                        {config.label}
                      </div>
                    </div>

                    
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-white/20 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </EmployeePortalLayout>
  );
}