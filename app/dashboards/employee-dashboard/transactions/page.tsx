"use client";

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, CheckCircle2, Clock, AlertCircle,
  History, Smartphone, Calendar, Download,
   Loader2, Landmark, Search, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, cn } from '@/lib/utils';
import { EmployeePortalLayout } from '@/components/employee/EmployeeLayout';
import Link from 'next/link';
import { toast } from 'sonner';

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
}

interface StatusConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bg: string;
  pulse?: boolean;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Transactions() {
    const [advances, setAdvances] = useState<Advance[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchAdvances = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/employee-dashboard/transactions');
                const data = await response.json();
                setAdvances(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error('Error fetching advances:', error);
                toast.error('Failed to sync transactions');
            } finally {
                setLoading(false);
            }
        };
        fetchAdvances();
    }, []);

    const allItems: TransactionItem[] = advances.map((a) => ({
      id: a.id,
      type: 'advance' as const,
      amount: a.amount,
      status: a.status,
      method: a.disbursement_method,
      created_at: a.created_at,
    })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const filteredItems = allItems.filter(item => {
      const matchesFilter = filter === 'all' 
        ? true 
        : filter === 'pending' ? (item.status === 'pending' || item.status === 'approved')
        : filter === 'completed' ? (item.status === 'disbursed' || item.status === 'completed')
        : item.status === 'rejected';
      
      const matchesSearch = searchTerm === '' 
        ? true 
        : item.amount.toString().includes(searchTerm) || item.status.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesFilter && matchesSearch;
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
          return { icon: CheckCircle2, label: 'Completed', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' };
        case 'pending':
          return { icon: Clock, label: 'Processing', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20', pulse: true };
        case 'approved':
          return { icon: CheckCircle2, label: 'Approved', color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20' };
        case 'rejected':
          return { icon: AlertCircle, label: 'Failed', color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/20' };
        default:
          return { icon: Clock, label: status, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' };
      }
    };

    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      const now = new Date();
      if (date.toDateString() === now.toDateString()) return 'Today';
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const filters: Array<{ id: FilterType; label: string; count: number }> = [
      { id: 'all', label: 'All', count: allItems.length },
      { id: 'pending', label: 'Pending', count: allItems.filter(i => i.status === 'pending' || i.status === 'approved').length },
      { id: 'completed', label: 'Done', count: allItems.filter(i => i.status === 'disbursed' || i.status === 'completed').length },
      { id: 'failed', label: 'Failed', count: allItems.filter(i => i.status === 'rejected').length },
    ];

    return (
    <EmployeePortalLayout title="Ledger">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary w-fit border border-primary/20">
              <History className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Transaction History</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">Recent Activity</h1>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">
              A comprehensive overview of your wage advances and disbursements.
            </p>
          </div>
          
          <Button variant="outline" className="rounded-2xl h-12 px-6 border-slate-200 dark:border-slate-700 font-bold text-xs uppercase tracking-wider">
            <Download className="w-4 h-4 mr-2" /> Export Report
          </Button>
        </div>

        {/* Highlight Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 dark:bg-slate-900/5 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">This Month</p>
            </div>
            <h2 className="text-3xl font-black tracking-tighter" data-testid="monthly-total">
              {formatCurrency(monthlyTotal).split('.')[0]}
            </h2>
            <p className="text-[10px] font-bold mt-1 opacity-40 uppercase tracking-widest">Total Disbursements</p>
          </div>

          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/30 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Activity Count</p>
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
              {totalTransactions}
            </h2>
            <p className="text-[10px] font-bold mt-1 text-slate-400 uppercase tracking-widest">Successful Transactions</p>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search amount or status..."
                className="h-12 pl-10 rounded-2xl bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 backdrop-blur-sm"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 no-scrollbar">
              {filters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "flex items-center gap-2 h-12 px-5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 border",
                    filter === f.id
                      ? "bg-primary text-white border-transparent shadow-lg shadow-primary/20"
                      : "bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm text-slate-500 border-slate-200 dark:border-slate-700 hover:border-primary/50"
                  )}
                >
                  {f.label}
                  {f.count > 0 && (
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-lg text-[9px]",
                      filter === f.id ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"
                    )}>{f.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/30 rounded-[2.5rem] overflow-hidden shadow-sm min-h-100">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Syncing Ledger...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-700/50">
                <History className="w-10 h-10 text-slate-200 dark:text-slate-700" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">No Activity</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-50 mx-auto">You haven&apos;t made any advance requests yet.</p>
              <Link href="/dashboards/employee-dashboard/request-advance" className="mt-6">
                <Button className="h-12 px-8 bg-primary text-white font-black uppercase tracking-widest rounded-xl shadow-xl shadow-primary/20">
                  Request Funds
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.map((item) => {
                const config = getStatusConfig(item.status);
                const StatusIcon = config.icon;
                return (
                  <div
                    key={item.id}
                    className="p-6 transition-all hover:bg-slate-50/50 dark:hover:bg-white/2 group"
                  >
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border transition-all",
                        item.method === 'mobile_money' ? "bg-primary/5 border-primary/10" : "bg-blue-500/5 border-blue-500/10"
                      )}>
                        {item.method === 'mobile_money' ? (
                          <Smartphone className="w-6 h-6 text-primary" />
                        ) : (
                          <Landmark className="w-6 h-6 text-blue-500" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-slate-900 dark:text-white leading-none">Wage Advance</p>
                          {config.pulse && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <span>{formatDate(item.created_at)}</span>
                          <span>•</span>
                          <span>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={cn(
                          "text-lg font-black tracking-tight mb-1",
                          item.status === 'rejected' ? "text-slate-300 dark:text-slate-600 line-through" : "text-slate-900 dark:text-white"
                        )}>
                          {formatCurrency(item.amount).split('.')[0]}
                        </p>
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border",
                          config.bg,
                          config.color
                        )}>
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </div>
                      </div>
                      
                      <div className="hidden sm:flex ml-4">
                        <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    </div>
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
