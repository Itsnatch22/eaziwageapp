"use client"
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, CheckCircle2, Clock, AlertCircle,
  History, Smartphone, Calendar, Building2, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, cn } from '@/lib/utils';
import { EmployeePageLayout, EmployeeHeader } from '@/components/employee/EmployeeLayout';
import Link from 'next/link';

type AdvanceStatus = 'pending' | 'approved' | 'disbursed' | 'completed' | 'rejected' | string;
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
  allItems?: TransactionItem[]; // For potential future use if we add more transaction types
}

interface StatusConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bg: string;
  pulse?: boolean;
}

export default function Transactions() {
    const [advances, setAdvances] = useState<Advance[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');

    useEffect(() => {
        const fetchAdvances = async () => {
            try {
                const response = await fetch('/api/employee/advances');
                const data: unknown = await response.json();
                setAdvances(Array.isArray(data) ? (data as Advance[]) : []);
            } catch (error) {
                console.error('Error fetching advances:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAdvances();
    }, []);

    const allItems: TransactionItem[] = advances.map<TransactionItem>((a) => ({
    id: a.id,
    type: 'advance',
    amount: a.amount,
    status: a.status,
    method: a.disbursement_method,
    created_at: a.created_at,
  })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filteredItems = allItems.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'pending') return item.status === 'pending' || item.status === 'approved';
    if (filter === 'completed') return item.status === 'disbursed' || item.status === 'completed';
    if (filter === 'failed') return item.status === 'rejected';
    return true;
  });

  const currentMonth = new Date().getMonth();
  const monthlyTotal = advances
    .filter(a => new Date(a.created_at).getMonth() === currentMonth && (a.status === 'disbursed' || a.status === 'completed'))
    .reduce((sum, a) => sum + a.amount, 0);
  const totalTransactions = advances.filter(a => a.status === 'disbursed' || a.status === 'completed').length;

  const getStatusConfig = (status: AdvanceStatus): StatusConfig => {
    switch (status) {
      case 'disbursed':
      case 'completed':
        return { icon: CheckCircle2, label: 'Completed', color: 'text-primary', bg: 'bg-primary/10' };
      case 'pending':
        return { icon: Clock, label: 'Processing', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/20', pulse: true };
      case 'approved':
        return { icon: CheckCircle2, label: 'Approved', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/20' };
      case 'rejected':
        return { icon: AlertCircle, label: 'Failed', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-500/20' };
      default:
        return { icon: Clock, label: status, color: 'text-slate-600', bg: 'bg-slate-100' };
    }
  };

  const formatDate = (dateString: string | number | Date) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filters: Array<{ id: FilterType; label: string; count: number }> = [
    { id: 'all', label: 'All', count: allItems.length },
    { id: 'pending', label: 'Pending', count: allItems.filter(i => i.status === 'pending' || i.status === 'approved').length },
    { id: 'completed', label: 'Completed', count: allItems.filter(i => i.status === 'disbursed' || i.status === 'completed').length },
    { id: 'failed', label: 'Failed', count: allItems.filter(i => i.status === 'rejected').length },
  ];

  return (
    <EmployeePageLayout>
      <EmployeeHeader title="Transactions" />

      <main className="relative z-10 max-w-md mx-auto px-4 pb-28 space-y-5">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center mb-2.5">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-0.5">This Month</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white" data-testid="monthly-total">
              {formatCurrency(monthlyTotal)}
            </p>
          </div>
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
            <div className="w-9 h-9 bg-blue-100 dark:bg-blue-500/20 rounded-xl flex items-center justify-center mb-2.5">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-0.5">Total Transactions</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{totalTransactions}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "flex items-center gap-2 h-9 min-w-fit shrink-0 px-4 rounded-xl text-sm font-semibold transition-all",
                filter === f.id
                  ? "bg-linear-to-r from-primary to-emerald-600 text-white shadow-lg shadow-primary/25"
                  : "bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/30"
              )}
              data-testid={`filter-${f.id}`}
            >
              {f.label}
              {f.count > 0 && (
                <span className={cn(
                  "text-xs font-bold px-1.5 py-0.5 rounded-full min-w-4.5 text-center",
                  filter === f.id
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                )}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Transaction List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Recent Activity</h3>
            <button className="text-primary text-xs font-semibold flex items-center gap-1" data-testid="export-btn">
              <Download className="w-3 h-3" /> Export
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                <History className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-semibold text-sm">No transactions found</p>
              <p className="text-xs text-slate-400 mt-1">Your transaction history will appear here</p>
              <Link href="/employee/advances" className="mt-4">
                <Button className="bg-linear-to-r from-primary to-emerald-600 text-white font-semibold text-sm shadow-lg shadow-primary/25">
                  Request Your First Advance
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const config = getStatusConfig(item.status);
                const StatusIcon = config.icon;
                return (
                  <div
                    key={item.id}
                    className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30"
                    data-testid={`transaction-${item.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                        item.method === 'mobile_money' ? "bg-primary/10" : "bg-blue-100 dark:bg-blue-500/20"
                      )}>
                        {item.method === 'mobile_money' ? (
                          <Smartphone className="w-5 h-5 text-primary" />
                        ) : (
                          <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-slate-900 dark:text-white text-sm">Wage Advance</p>
                          {config.pulse && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(item.created_at)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn(
                          "text-base font-bold mb-0.5",
                          item.status === 'rejected' ? "text-slate-400 line-through" : "text-slate-900 dark:text-white"
                        )}>
                          {formatCurrency(item.amount)}
                        </p>
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
                          config.bg,
                          config.color
                        )}>
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </EmployeePageLayout>
  );
}
