'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Wallet, TrendingUp, AlertTriangle } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import EmployerDetailNav from '../EmployerDetailNav';
import { CopyButton } from '@/components/shared/CopyButton';

interface WalletTransaction {
  id: string;
  amount: number;
  type: string;
  status: string;
  description: string | null;
  reference: string | null;
  created_at: string;
}

interface WalletPayload {
  live_employer_id: string;
  company_name: string;
  wallet: {
    total_advanced: number;
    outstanding_liability: number;
    total_repaid: number;
    currency: string;
    reserved_amount: number;
  } | null;
  transactions: WalletTransaction[];
}

export default function EmployerWalletClient({ employerId }: { employerId: string }) {
  const [data, setData] = useState<WalletPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/employers/${employerId}/wallet`);
      if (!res.ok) {
        setError(res.status === 404 ? 'Employer not found.' : 'Failed to load wallet.');
        return;
      }
      setData(await res.json());
    } catch {
      setError('Failed to load wallet.');
    } finally {
      setLoading(false);
    }
  }, [employerId]);

  useEffect(() => {
    Promise.resolve().then(() => void fetchWallet());
  }, [fetchWallet]);

  // No live_employer_id to filter on until the first fetch resolves — refresh on
  // any change to these tables rather than scoping the subscription.
  useRealtimeRefresh(
    [{ table: 'employer_wallets' }, { table: 'wallet_transactions' }],
    () => fetchWallet(),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Activity className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <EmployerDetailNav employerId={employerId} />
        <div className="text-center py-12 text-slate-500">{error || 'Failed to load wallet.'}</div>
      </div>
    );
  }

  const { wallet, transactions, company_name } = data;
  const currency = wallet?.currency || 'KES';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <EmployerDetailNav employerId={employerId} companyName={company_name} />

      {!wallet && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          This employer has no wallet yet — one is created on first funding.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-sm font-medium text-slate-500">Total Funded</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(wallet?.total_advanced ?? 0, currency)}</p>
        </div>
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-sm font-medium text-slate-500">Outstanding Liability</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(wallet?.outstanding_liability ?? 0, currency)}</p>
        </div>
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-500">Total Repaid</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(wallet?.total_repaid ?? 0, currency)}</p>
        </div>
      </div>

      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/30">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-left">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Reference</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Type</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Amount</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
              {transactions.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No transactions yet.</td></tr>
              )}
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-500">{new Date(tx.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    {tx.reference ? (
                      <span className="flex items-center gap-1.5">
                        {tx.reference}
                        <CopyButton value={tx.reference} label="Copy reference" variant="ghost" size="sm" />
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm capitalize text-slate-700 dark:text-slate-300">{tx.type}</td>
                  <td className={cn('px-6 py-4 text-sm font-semibold', Number(tx.amount) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {Number(tx.amount) >= 0 ? '+' : '-'}{formatCurrency(Math.abs(Number(tx.amount)), currency)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium capitalize',
                      tx.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' :
                      tx.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                    )}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
