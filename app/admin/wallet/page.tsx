'use client';

import React, { useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface WalletRow {
  id: string;
  account_number: string;
  currency: string;
  balance: number;
  last_synced_at: string | null;
  created_at: string;
}

export default function AdminWalletPage() {
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [transactions, setTransactions] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchWallet = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const res = await fetch('/api/admin/wallet/sync');
      if (res.ok) {
        const data = await res.json();
        setWallet(data?.wallet ?? null);
        setTransactions(data?.transactions ?? []);
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        toast.error((err && (err as { error?: string }).error) || 'Failed to fetch wallet');
      }
    } catch (err) {
      console.error('Fetch wallet error:', err);
      toast.error('Failed to fetch wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer to avoid sync setState inside effect
    Promise.resolve().then(() => void fetchWallet({ silent: true }));
  }, [fetchWallet]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/wallet/sync', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setWallet(data?.wallet ?? null);
        // After syncing, re-fetch transactions
        await fetchWallet();
        toast.success('Wallet synced');
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        toast.error((err && (err as { error?: string }).error) || 'Sync failed');
      }
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Sync failed');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Stanbic Wallet</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">View and manually sync the platform Stanbic account balance</p>
        </div>
        <div className="ml-auto">
          <Button onClick={onRefresh} disabled={refreshing} className="bg-white/60 dark:bg-slate-800/60">
            <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </div>

      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
          </div>
        ) : !wallet ? (
          <div className="text-center py-16">
            <p className="text-slate-500">No admin wallet recorded. Use sync to fetch the account balance.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-500">Wallet</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white mt-1">{wallet?.name}</p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Currency</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white mt-1">{wallet?.currency}</p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Current Balance</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(wallet?.balance ?? 0, wallet?.currency ?? 'KES')}</p>
            </div>

            <div className="text-sm text-slate-500">
              Last reconciled: {wallet?.last_reconciled_at ? formatDateTime(wallet.last_reconciled_at) : 'Never'}
            </div>

            <div className="pt-4">
              <Button onClick={onRefresh} disabled={refreshing} className="bg-green-600 hover:bg-green-700 text-white">
                {refreshing ? 'Refreshing...' : 'Sync Now'}
              </Button>
            </div>

            <div className="pt-6">
              <h3 className="text-lg font-semibold">Recent Transactions</h3>
              <div className="mt-3">
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-slate-500">
                      <tr>
                        <th className="py-2">Type</th>
                        <th className="py-2">Amount</th>
                        <th className="py-2">Status</th>
                        <th className="py-2">Description</th>
                        <th className="py-2">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 ? (
                        <tr><td colSpan={5} className="py-6 text-center text-slate-500">No transactions</td></tr>
                      ) : transactions.map((tx: Record<string, unknown>) => (
                        <tr key={String(tx.id)} className="border-t border-slate-100">
                          <td className="py-3">{String(tx.type ?? '')}</td>
                          <td className="py-3">{formatCurrency(Number(tx.amount ?? 0), wallet?.currency ?? 'KES')}</td>
                          <td className="py-3">{String(tx.status ?? '')}</td>
                          <td className="py-3">{String(tx.description ?? '')}</td>
                          <td className="py-3">{String(tx.created_at ?? '')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
