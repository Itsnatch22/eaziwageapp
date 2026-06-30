'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, AlertTriangle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { toast } from 'sonner';

type AdminTxType =
  | 'stanbic_deposit'
  | 'dusupay_funding'
  | 'payout_settlement'
  | 'adjustment';

type TxStatus = 'completed' | 'pending' | 'failed';

interface AdminWallet {
  id: string;
  name: string;
  balance: number;
  currency: 'USD';
  last_reconciled_at: string | null;
  updated_at: string;
}

interface AdminWalletTransaction {
  id: string;
  admin_wallet_id: string;
  amount: number;
  type: AdminTxType;
  status: TxStatus;
  reference: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  local_currency: string | null;
  usd_amount: number | null;
}

interface SyncSuccessResponse {
  wallet: Pick<AdminWallet, 'id' | 'balance' | 'currency' | 'last_reconciled_at'>;
  transaction: AdminWalletTransaction;
}

interface SyncConflictResponse {
  error: string;
  previous: number;
  incoming: number;
}

interface DepositRequest {
  amount: number;
  reference?: string;
  description?: string;
}

interface ApiError {
  error: string;
}

interface ExchangeRate {
  currency_code: string;
  rate_to_usd: number;
  updated_at: string;
}

const TX_TYPE_LABELS: Record<AdminTxType, string> = {
  stanbic_deposit: 'Stanbic Deposit',
  dusupay_funding: 'Employer Funded',
  payout_settlement: 'Advance Repayment',
  adjustment: 'Balance Sync',
};

interface AdminWalletClientProps {
  initialWallet: AdminWallet | null;
  initialTransactions: AdminWalletTransaction[];
  exchangeRates: ExchangeRate[];
}

function getSyncStatusIndicator(lastReconciledAt: string | null): {
  color: string;
  label: string;
  minutesAgo: number | null;
  isStale: boolean;
} {
  if (!lastReconciledAt) {
    return { color: 'bg-red-500', label: 'Never synced', minutesAgo: null, isStale: true };
  }

  const now = new Date();
  const lastSync = new Date(lastReconciledAt);
  const minutesAgo = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60));
  const hoursDiff = minutesAgo / 60;

  if (hoursDiff < 2) {
    return { color: 'bg-green-500', label: 'Synced recently', minutesAgo, isStale: false };
  } else if (hoursDiff < 24) {
    return { color: 'bg-amber-500', label: 'Synced 2-24 hours ago', minutesAgo, isStale: true };
  } else {
    return { color: 'bg-red-500', label: 'Synced >24 hours ago', minutesAgo, isStale: true };
  }
}

function formatStaleness(minutesAgo: number | null): string {
  if (minutesAgo === null) return 'never synced';
  if (minutesAgo < 60) return `${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago`;
  const h = Math.floor(minutesAgo / 60);
  const m = minutesAgo % 60;
  if (h < 24) return m > 0 ? `${h}h ${m}m ago` : `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function formatAsOfEAT(lastReconciledAt: string | null): string {
  if (!lastReconciledAt) return '';
  const date = new Date(lastReconciledAt);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    timeZone: 'Africa/Nairobi',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDateTimeCompact(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function DepositModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DepositRequest) => Promise<void>;
  isLoading: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numAmount = parseFloat(amount);
    if (!amount || numAmount <= 0 || !isFinite(numAmount)) {
      setError('Amount must be a positive number');
      return;
    }

    if (reference && reference.length > 100) {
      setError('Reference must be less than 100 characters');
      return;
    }

    try {
      await onSubmit({
        amount: numAmount,
        reference: reference.trim() || undefined,
        description: description.trim() || undefined,
      });

      setAmount('');
      setReference('');
      setDescription('');
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to record deposit');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full border border-slate-200/50 dark:border-slate-700/30">
        <div className="flex items-center justify-between p-6 border-b border-slate-200/50 dark:border-slate-700/30">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Record Stanbic Deposit</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Amount (USD) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 5000.00"
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Bank Reference
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. STB-2026-001"
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={isLoading}
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Monthly capital injection"
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
            >
              {isLoading ? 'Recording...' : 'Record Deposit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TransactionTable({
  transactions,
  currentPage,
  onPageChange,
  walletCurrency,
}: {
  transactions: AdminWalletTransaction[];
  currentPage: number;
  onPageChange: (page: number) => void;
  walletCurrency: string;
}) {
  const itemsPerPage = 10;
  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const pageTransactions = transactions.slice(startIdx, startIdx + itemsPerPage);

  const getStatusBadgeColor = (status: TxStatus): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'pending':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
      case 'failed':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      default:
        return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Description</th>
            </tr>
          </thead>
          <tbody>
            {pageTransactions.length === 0 ? (
              <tr key="empty">
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  No transactions recorded yet.
                </td>
              </tr>
            ) : (
              pageTransactions.map((tx) => {
                const isCredit = tx.amount > 0;
                // The admin wallet is USD-denominated, but individual transactions
                // (e.g. employer top-ups) may be in the employer's local currency.
                const displayCurrency = tx.local_currency ?? walletCurrency;
                const displayAmount = tx.local_currency
                  ? tx.amount            // already in local currency
                  : tx.usd_amount ?? tx.amount; // fall back to usd_amount, then raw amount
                return (
                  <tr key={tx.id} className="border-t border-slate-200/50 dark:border-slate-700/30 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {formatDateTimeCompact(tx.created_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                      {TX_TYPE_LABELS[tx.type]}
                    </td>
                    <td className={`px-4 py-3 font-semibold ${isCredit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isCredit ? '+' : '−'}{formatCurrency(Math.abs(displayAmount), displayCurrency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(tx.status)}`}>
                        {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {tx.reference || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={tx.description || undefined}>
                      {tx.description ? (tx.description.length > 60 ? tx.description.substring(0, 60) + '…' : tx.description) : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminWalletClient({
  initialWallet,
  initialTransactions,
  exchangeRates,
}: AdminWalletClientProps) {
  const [wallet, setWallet] = useState<AdminWallet | null>(initialWallet);
  const [transactions, setTransactions] = useState<AdminWalletTransaction[]>(initialTransactions);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncConflict, setSyncConflict] = useState<SyncConflictResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [nextSyncIn, setNextSyncIn] = useState(30);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncError('');
    setSyncConflict(null);

    try {
      const response = await fetch('/api/admin/wallet/sync', {
        method: 'POST',
      });

      if (response.status === 409) {
        const conflictData = (await response.json()) as SyncConflictResponse;
        setSyncConflict(conflictData);
        toast.error('Suspicious balance drop detected. Please reconcile manually.');
        return;
      }

      if (!response.ok) {
        const errorData = (await response.json()) as ApiError;
        setSyncError(errorData.error || 'Failed to sync wallet');
        toast.error(errorData.error || 'Sync failed');
        return;
      }

      const data = (await response.json()) as SyncSuccessResponse;
      setWallet({
        id: data.wallet.id,
        name: wallet?.name || 'Main Stanbic Source',
        balance: data.wallet.balance,
        currency: data.wallet.currency as 'USD',
        last_reconciled_at: data.wallet.last_reconciled_at,
        updated_at: new Date().toISOString(),
      });

      setTransactions([data.transaction, ...transactions]);
      setCurrentPage(1);
      toast.success('Wallet synced successfully');
    } catch (error) {
      setSyncError('Failed to sync wallet');
      toast.error('Sync failed');
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [wallet, transactions]);

  const handleRecordDeposit = useCallback(
    async (data: DepositRequest) => {
      setIsDepositing(true);

      try {
        const response = await fetch('/api/admin/finances/stanbic-deposit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as ApiError;
          throw new Error(errorData.error || 'Failed to record deposit');
        }

        setWallet((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            balance: prev.balance + data.amount,
          };
        });

        const newTransaction: AdminWalletTransaction = {
          id: `deposit-${Date.now()}`,
          admin_wallet_id: wallet?.id || '',
          amount: data.amount,
          type: 'stanbic_deposit',
          status: 'completed',
          reference: data.reference || null,
          description: data.description || null,
          metadata: null,
          created_at: new Date().toISOString(),
          local_currency: null,  // Stanbic deposits are in USD — no local currency conversion
          usd_amount: null,
        };

        setTransactions([newTransaction, ...transactions]);
        setCurrentPage(1);
        toast.success('Deposit recorded successfully');
      } catch (error) {
        throw error;
      } finally {
        setIsDepositing(false);
      }
    },
    [wallet, transactions]
  );

  const syncStatus = useMemo(
    () => getSyncStatusIndicator(wallet?.last_reconciled_at || null),
    [wallet?.last_reconciled_at]
  );

  // Silent data refresh — called both on interval and on Realtime events
  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/wallet/sync', { method: 'GET' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.wallet) setWallet(data.wallet);
      if (data.transactions) setTransactions(data.transactions);
    } catch {
      // silent fail — background refresh must never surface errors
    }
  }, []);

  // Part 1 — silent UI data refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchLatest, 60_000);
    return () => clearInterval(interval);
  }, [fetchLatest]);

  // Realtime subscriptions — balance and transaction list update live after sync or funding approval
  useRealtimeRefresh(
    wallet?.id ? [
      { table: 'admin_wallets',             filter: `id=eq.${wallet.id}` },
      { table: 'admin_wallet_transactions',  filter: `admin_wallet_id=eq.${wallet.id}` },
    ] : [],
    () => void fetchLatest(),
  );

  // Part 2 — auto Stanbic bank sync every 30 minutes (POST via handleSync)
  useEffect(() => {
    const autoSync = async () => {
      if (isSyncing) return;      // manual sync already running
      if (syncConflict) return;   // unresolved conflict — admin must clear first
      if (!wallet) return;        // nothing to sync against

      // Guard: skip if a sync already happened in the last 25 minutes
      if (wallet.last_reconciled_at) {
        const minutesSinceSync =
          (Date.now() - new Date(wallet.last_reconciled_at).getTime()) / 60_000;
        if (minutesSinceSync < 25) return;
      }

      await handleSync();
    };
    const interval = setInterval(autoSync, 30 * 60_000);
    return () => clearInterval(interval);
  }, [isSyncing, syncConflict, wallet, handleSync]);

  // Part 4 — countdown timer (ticks every minute, resets at 0)
  useEffect(() => {
    const countdown = setInterval(() => {
      setNextSyncIn((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 60_000);
    return () => clearInterval(countdown);
  }, []);

  // Reset countdown whenever a sync completes (manual or auto)
  useEffect(() => {
    Promise.resolve().then(() => setNextSyncIn(30));
  }, [wallet?.last_reconciled_at]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 py-6">
      <div className="flex items-start gap-4">
        <Link
          href="/admin"
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Wallet & Banking Sync</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Manage EaziWage platform wallet balance and Stanbic account reconciliation
          </p>
        </div>
      </div>

      {syncConflict && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">Sync Warning</h3>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Stanbic returned a balance of <span className="font-semibold">${syncConflict.incoming.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>, which is more than 50% lower than the current recorded balance of <span className="font-semibold">${syncConflict.previous.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>. The balance has NOT been updated. Please reconcile manually before proceeding.
            </p>
          </div>
          <button
            onClick={() => setSyncConflict(null)}
            className="text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800/50 p-1 rounded transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {syncStatus.isStale && (
        <div className={`p-3 rounded-lg flex items-center gap-3 border ${
          syncStatus.color === 'bg-red-500'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}>
          <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${
            syncStatus.color === 'bg-red-500'
              ? 'text-red-500 dark:text-red-400'
              : 'text-amber-500 dark:text-amber-400'
          }`} />
          <p className={`text-sm flex-1 ${
            syncStatus.color === 'bg-red-500'
              ? 'text-red-800 dark:text-red-200'
              : 'text-amber-800 dark:text-amber-200'
          }`}>
            Balance last synced <span className="font-semibold">{formatStaleness(syncStatus.minutesAgo)}</span> — may not reflect current Stanbic balance
          </p>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50 ${
              syncStatus.color === 'bg-red-500'
                ? 'bg-red-100 dark:bg-red-800/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-700/50'
                : 'bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-700/50'
            }`}
          >
            {isSyncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-8 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${syncStatus.color}`} />
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">EaziWage Stanbic Wallet</p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                  {wallet?.last_reconciled_at
                    ? `Last synced: ${formatDateTime(wallet.last_reconciled_at)}`
                    : 'Never synced'}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                Live
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Next auto-sync in {nextSyncIn}m
              </p>
            </div>
          </div>

          {wallet ? (
            <>
              <div className="mb-8">
                <p className="text-5xl font-bold text-slate-900 dark:text-white mb-2">
                  {formatCurrency(wallet.balance, wallet.currency)}
                </p>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span>{wallet.currency}</span>
                  {wallet.last_reconciled_at && (
                    <span className="text-slate-400 dark:text-slate-500">
                      · As of {formatAsOfEAT(wallet.last_reconciled_at)} EAT
                    </span>
                  )}
                </div>
              </div>

              {syncError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                  {syncError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin')} />
                  {isSyncing ? 'Syncing…' : 'Sync with Stanbic'}
                </button>
                <button
                  onClick={() => setDepositModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200/50 dark:bg-slate-700/50 hover:bg-slate-300/50 dark:hover:bg-slate-600/50 text-slate-900 dark:text-white rounded-lg transition-colors font-medium"
                >
                  Record Stanbic Deposit
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400 mb-4">No wallet data available</p>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
              >
                <RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin')} />
                {isSyncing ? 'Syncing…' : 'Sync Wallet'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Exchange Rates</h3>
          <div className="space-y-3">
            {exchangeRates.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No exchange rate data available</p>
            ) : (
              exchangeRates.map((rate) => (
                <div key={rate.currency_code} className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {rate.currency_code}
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      1 USD = {rate.rate_to_usd.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    Updated: {formatDate(rate.updated_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-8 border border-slate-200/50 dark:border-slate-700/30">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Transaction Audit Trail</h2>
        <TransactionTable
          transactions={transactions}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          walletCurrency={wallet?.currency ?? 'USD'}
        />
      </div>

      <DepositModal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        onSubmit={handleRecordDeposit}
        isLoading={isDepositing}
      />
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
