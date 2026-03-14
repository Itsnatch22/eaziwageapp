"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Wallet, TrendingUp, History, Download, CreditCard, ArrowUpRight, 
  ArrowDownLeft, Plus, Building2, Calendar, AlertCircle, Info, Loader2, CheckCircle2
} from 'lucide-react';
import { EmployerPortalLayout } from '@/components/employer/EmployerLayout';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { GradientIconBox } from '@/components/employer/SharedComponents';

interface Transaction {
  id: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'payout' | 'refund' | 'arrears_payment';
  status: 'pending' | 'completed' | 'failed';
  reference: string;
  description: string;
  created_at: string;
}

interface WalletData {
  id: string;
  balance: number;
  arrears_balance: number;
  currency: string;
}

const WalletPage = () => {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [employer, setEmployer] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [walletRes, profileRes] = await Promise.all([
        fetch('/api/employer-dashboard/wallet'),
        fetch('/api/employer-dashboard/profile')
      ]);

      if (walletRes.ok) {
        const data = await walletRes.json();
        setWallet(data.wallet);
        setTransactions(data.transactions);
      }

      if (profileRes.ok) {
        const data = await profileRes.json();
        setEmployer(data.profile);
      }
    } catch (err) {
      console.error('Failed to load wallet data', err);
      toast.error('Failed to load wallet information');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <ArrowDownLeft className="w-4 h-4 text-emerald-500" />;
      case 'payout':  return <ArrowUpRight className="w-4 h-4 text-blue-500" />;
      case 'arrears_payment': return <CheckCircle2 className="w-4 h-4 text-purple-500" />;
      default: return <CreditCard className="w-4 h-4 text-slate-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300';
      case 'pending':   return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300';
      default:          return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300';
    }
  };

  return (
    <EmployerPortalLayout employer={employer}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Wallet & Funding</h1>
            <p className="text-slate-500 dark:text-slate-400">Manage your pre-funded wallet and track disbursement history.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => setShowTopUpModal(true)}
              className="bg-primary text-white shadow-lg shadow-primary/25 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" /> Top-up Wallet
            </Button>
            <Button variant="outline" className="rounded-xl border-slate-200 dark:border-slate-700">
              <Download className="w-4 h-4 mr-2" /> Export History
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-linear-to-br from-primary to-emerald-600 rounded-3xl p-6 text-white shadow-xl shadow-primary/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
              <Wallet className="w-24 h-24" />
            </div>
            <p className="text-white/80 font-medium mb-1">Available Balance</p>
            <h2 className="text-4xl font-bold tracking-tight">
              {loading ? "..." : formatCurrency(wallet?.balance || 0, wallet?.currency || 'KES')}
            </h2>
            <div className="mt-6 flex items-center gap-2 text-sm bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
              <CheckCircle2 className="w-4 h-4" /> Ready for disbursement
            </div>
          </div>

          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-4">
              <GradientIconBox icon={AlertCircle} size="md" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Outstanding Arrears</p>
            </div>
            <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
              {loading ? "..." : formatCurrency(wallet?.arrears_balance || 0, wallet?.currency || 'KES')}
            </h3>
            <p className="text-xs text-slate-500 mt-2">To be recouped from next payroll or top-up.</p>
          </div>

          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl p-6 border border-slate-200/50 dark:border-slate-700/30 flex flex-col justify-center">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/20 rounded-2xl flex items-center justify-center">
                   <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Disbursed</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                     {formatCurrency(transactions.filter(t => t.type === 'payout' && t.status === 'completed').reduce((sum, t) => sum + Math.abs(t.amount), 0), 'KES')}
                  </p>
                </div>
             </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GradientIconBox icon={History} size="md" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Transactions</h3>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-slate-500">No transactions recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-left">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Date</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Reference</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Type</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Description</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Amount</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDateTime(tx.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-white font-mono">
                        {tx.reference || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                            {getTransactionIcon(tx.type)}
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                            {tx.type.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {tx.description || '-'}
                      </td>
                      <td className={cn(
                        "px-6 py-4 whitespace-nowrap font-bold",
                        tx.amount > 0 ? "text-emerald-600" : "text-slate-900 dark:text-white"
                      )}>
                        {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount, wallet?.currency || 'KES')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest", getStatusColor(tx.status))}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top-up Modal Placeholder */}
        {showTopUpModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowTopUpModal(false)}>
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="bg-linear-to-r from-primary to-emerald-600 p-8 text-white">
                <div className="flex items-center justify-between mb-2">
                   <h2 className="text-2xl font-bold">Wallet Top-up</h2>
                   <CreditCard className="w-8 h-8 opacity-50" />
                </div>
                <p className="text-white/80">Add funds to enable EWA for your employees.</p>
              </div>
              <div className="p-8 space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-start gap-4">
                  <Info className="w-6 h-6 text-blue-600 mt-1" />
                  <div>
                    <p className="font-bold text-blue-900 dark:text-blue-200">Payment Instructions</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      To top up your wallet, please make a deposit to the following account using your Company Code as the reference:
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Bank Name</p>
                      <p className="font-bold text-slate-900 dark:text-white">Stanbic Bank Kenya</p>
                   </div>
                   <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Account Number</p>
                      <p className="font-bold text-slate-900 dark:text-white">010000XXXXXXX</p>
                   </div>
                   <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Payment Reference</p>
                      <p className="font-bold text-primary">{employer?.company_code || 'N/A'}</p>
                   </div>
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800">
                   <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                     <AlertCircle className="w-4 h-4" /> Funds will reflect within 2-24 hours after verification.
                   </p>
                </div>

                <Button onClick={() => setShowTopUpModal(false)} className="w-full bg-primary text-white h-12 rounded-2xl shadow-lg">
                  Understood
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </EmployerPortalLayout>
  );
};

export default WalletPage;
