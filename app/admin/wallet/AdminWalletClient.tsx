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
  | 'employee_disbursement'
  | 'internal_treasury_transfer'
  | 'adjustment';

type TxStatus = 'completed' | 'pending' | 'failed';

interface AdminWallet {
  id: string;
  name: string;
  balance: number;
  currency: string;
  country_code: string | null;
  account_number: string | null;
  bank_name: string | null;
  branch_name: string | null;
  branch_code: string | null;
  bank_code: string | null;
  swift_code: string | null;
  paybill_number: string | null;
  supports_mpesa_deposit: boolean | null;
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
  transaction?: AdminWalletTransaction;
  currencyAnomaly?: boolean;
}

interface SyncConflictResponse {
  error: string;
  previous: number;
  incoming: number;
}

interface DepositRequest {
  wallet_id?: string;
  amount: number;
  reference?: string;
  description?: string;
}

interface ApiError {
  error: string;
}

interface ReconciliationFlag {
  id: string;
  wallet_transaction_id: string;
  recorded_amount: number;
  balance_before_sync: number;
  stanbic_reported_balance: number;
  created_at: string;
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
  employee_disbursement: 'Employee Disbursement',
  internal_treasury_transfer: 'Internal Transfer',
  adjustment: 'Balance Sync',
};

interface AdminWalletClientProps {
  initialWallet: AdminWallet | null;
  initialWallets: AdminWallet[];
  initialTransactions: AdminWalletTransaction[];
  exchangeRates: ExchangeRate[];
  lowBalanceThresholdUsd: number | null;
  initialReconciliationFlags: ReconciliationFlag[];
  initialForecasts: CashRequirementForecast[];
}

interface CashRequirementForecast {
  id: string;
  forecast_date: string;
  country_code: string;
  currency: string;
  total_required_amount: number;
  employee_count: number;
  updated_at: string;
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
    return { color: 'bg-emerald-500', label: 'Synced recently', minutesAgo, isStale: false };
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
  walletCurrency = 'USD',
  walletId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DepositRequest) => Promise<void>;
  isLoading: boolean;
  walletCurrency?: string;
  walletId?: string;
}) {
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const handleReview = (e: React.FormEvent) => {
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

    setConfirming(true);
  };

  const handleConfirm = async () => {
    setError('');
    try {
      await onSubmit({
        wallet_id: walletId,
        amount: parseFloat(amount),
        reference: reference.trim() || undefined,
        description: description.trim() || undefined,
      });

      setAmount('');
      setReference('');
      setDescription('');
      setConfirming(false);
      onClose();
    } catch (err) {
      setConfirming(false);
      setError((err as Error).message || 'Failed to record deposit');
    }
  };

  const handleClose = () => {
    setConfirming(false);
    onClose();
  };

  if (!isOpen) return null;

  if (confirming) {
    const numAmount = parseFloat(amount);
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center justify-between p-6 border-b border-slate-200/50 dark:border-slate-700/30">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Confirm Stanbic Deposit</h2>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <p className="text-sm text-slate-600 dark:text-slate-400">
              This credits the selected Stanbic wallet ({walletCurrency}), which backs platform operations. Please confirm the amount is correct before proceeding.
            </p>

            <div className="text-center py-4">
              <div className="text-3xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(numAmount, walletCurrency)}
              </div>
              {reference && (
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-2">Ref: {reference}</div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
              >
                {isLoading ? 'Recording...' : `Confirm ${formatCurrency(numAmount, walletCurrency)}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

        <form onSubmit={handleReview} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Amount ({walletCurrency}) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`e.g. ${walletCurrency === 'KES' ? '500.00' : '5000.00'}`}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              placeholder="e.g. Direct M-Pesa / Bank deposit"
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
            >
              Review Deposit
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
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
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
                    <td className={`px-4 py-3 font-semibold ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
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
  initialWallets,
  initialTransactions,
  exchangeRates,
  lowBalanceThresholdUsd,
  initialReconciliationFlags,
  initialForecasts,
}: AdminWalletClientProps) {
  const [wallet, setWallet] = useState<AdminWallet | null>(initialWallet);
  const [wallets, setWallets] = useState<AdminWallet[]>(initialWallets);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(initialWallet?.id ?? initialWallets[0]?.id ?? null);
  const [transactions, setTransactions] = useState<AdminWalletTransaction[]>(initialTransactions);
  const [reconciliationFlags, setReconciliationFlags] = useState<ReconciliationFlag[]>(initialReconciliationFlags);
  const [resolvingFlagId, setResolvingFlagId] = useState<string | null>(null);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_id: selectedWalletId }),
      });

      if (response.status === 409) {
        const conflictData = (await response.json()) as Partial<SyncConflictResponse> & ApiError;
        if (typeof conflictData.previous === 'number' && typeof conflictData.incoming === 'number') {
          setSyncConflict(conflictData as SyncConflictResponse);
          toast.error('Suspicious balance drop detected. Please reconcile manually.');
        } else {
          const message = conflictData.error || 'Stanbic response did not match the selected wallet';
          setSyncError(message);
          toast.error(message);
        }
        return;
      }

      if (!response.ok) {
        const errorData = (await response.json()) as ApiError;
        setSyncError(errorData.error || 'Failed to sync wallet');
        toast.error(errorData.error || 'Sync failed');
        return;
      }

      const data = (await response.json()) as SyncSuccessResponse;
      const currentWallet = wallets.find((w) => w.id === data.wallet.id) ?? wallet;
      const updatedWallet: AdminWallet = {
        id: data.wallet.id,
        name: currentWallet?.name || 'Stanbic Account',
        balance: data.wallet.balance,
        currency: data.wallet.currency,
        country_code: currentWallet?.country_code ?? null,
        last_reconciled_at: data.wallet.last_reconciled_at,
        updated_at: new Date().toISOString(),
        account_number: currentWallet?.account_number ?? null,
        bank_name: currentWallet?.bank_name ?? null,
        branch_name: currentWallet?.branch_name ?? null,
        branch_code: currentWallet?.branch_code ?? null,
        bank_code: currentWallet?.bank_code ?? null,
        swift_code: currentWallet?.swift_code ?? null,
        paybill_number: currentWallet?.paybill_number ?? null,
        supports_mpesa_deposit: currentWallet?.supports_mpesa_deposit ?? false,
      };
      setWallet(updatedWallet);
      setWallets((prev) => prev.map((item) => item.id === updatedWallet.id ? { ...item, ...updatedWallet } : item));

      // The sync route doesn't return the inserted admin_wallet_transactions
      // row directly — only prepend if a future response ever includes one;
      // otherwise the realtime subscription above already refreshes the list.
      if (data.transaction) {
        setTransactions([data.transaction, ...transactions]);
      }
      setCurrentPage(1);

      if (data.currencyAnomaly) {
        toast.warning('Balance synced, but Stanbic returned a non-USD currency — currency was left unchanged. Review the latest transaction before trusting it.', { duration: 8000 });
      } else {
        toast.success('Wallet synced successfully');
      }
    } catch (error) {
      setSyncError('Failed to sync wallet');
      toast.error('Sync failed');
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [wallet, wallets, transactions, selectedWalletId]);

  const handleRecordDeposit = useCallback(
    async (data: DepositRequest) => {
      setIsDepositing(true);

      const targetWalletId = data.wallet_id || wallet?.id;
      const targetWallet = wallets.find((w) => w.id === targetWalletId) ?? wallet;

      try {
        const response = await fetch('/api/admin/finances/stanbic-deposit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...data,
            wallet_id: targetWalletId,
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as ApiError;
          throw new Error(errorData.error || 'Failed to record deposit');
        }

        const addedAmount = data.amount;

        setWallet((prev) => {
          if (!prev) return prev;
          if (targetWalletId && prev.id !== targetWalletId) return prev;
          return {
            ...prev,
            balance: prev.balance + addedAmount,
          };
        });

        setWallets((prev) =>
          prev.map((w) =>
            w.id === targetWalletId ? { ...w, balance: w.balance + addedAmount } : w
          )
        );

        const newTransaction: AdminWalletTransaction = {
          id: `deposit-${Date.now()}`,
          admin_wallet_id: targetWalletId || wallet?.id || '',
          amount: data.amount,
          type: 'stanbic_deposit',
          status: 'completed',
          reference: data.reference || null,
          description: data.description || null,
          metadata: null,
          created_at: new Date().toISOString(),
          local_currency: targetWallet?.currency ?? null,
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
    [wallet, wallets, transactions]
  );

  const handleResolveFlag = useCallback(
    async (flagId: string, status: 'resolved' | 'dismissed') => {
      setResolvingFlagId(flagId);
      try {
        const response = await fetch(`/api/admin/finances/stanbic-reconciliation/${flagId}/resolve`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as ApiError;
          throw new Error(errorData.error || 'Failed to resolve flag');
        }

        setReconciliationFlags((prev) => prev.filter((f) => f.id !== flagId));
        toast.success(status === 'resolved' ? 'Deposit confirmed as genuine' : 'Flag dismissed');
      } catch (error) {
        toast.error((error as Error).message || 'Failed to resolve flag');
      } finally {
        setResolvingFlagId(null);
      }
    },
    [],
  );

  const syncStatus = useMemo(
    () => getSyncStatusIndicator(wallet?.last_reconciled_at || null),
    [wallet?.last_reconciled_at]
  );

  const isLowBalance = useMemo(
    () => wallet != null && lowBalanceThresholdUsd != null && wallet.balance <= lowBalanceThresholdUsd,
    [wallet, lowBalanceThresholdUsd]
  );

  const selectedTransactions = useMemo(
    () => transactions.filter((tx) => !selectedWalletId || tx.admin_wallet_id === selectedWalletId),
    [transactions, selectedWalletId],
  );

  const latestForecast = initialForecasts[0] ?? null;

  const kenyaConsolidatedKes = useMemo(() => {
    const kesRate = exchangeRates.find((rate) => rate.currency_code.toUpperCase() === 'KES')?.rate_to_usd;
    return wallets
      .filter((item) => (item.country_code ?? 'KE').toUpperCase() === 'KE')
      .reduce((sum, item) => {
        if (item.currency.toUpperCase() === 'KES') return sum + Number(item.balance ?? 0);
        if (item.currency.toUpperCase() === 'USD' && kesRate) return sum + Number(item.balance ?? 0) * kesRate;
        return sum;
      }, 0);
  }, [wallets, exchangeRates]);

  // Silent data refresh — called both on interval and on Realtime events
  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/wallet/sync', { method: 'GET' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.wallet) setWallet(data.wallet);
      if (data.wallets) setWallets(data.wallets);
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
    wallets.length > 0 ? [
      { table: 'admin_wallets' },
      ...(selectedWalletId ? [{ table: 'admin_wallet_transactions', filter: `admin_wallet_id=eq.${selectedWalletId}` }] : []),
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {wallets.map((item) => {
          const selected = item.id === selectedWalletId;
          const status = getSyncStatusIndicator(item.last_reconciled_at);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedWalletId(item.id);
                setWallet(item);
                setCurrentPage(1);
              }}
              className={cn(
                'text-left rounded-lg border p-4 bg-white/70 dark:bg-slate-900/70 transition-colors',
                selected
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'border-slate-200/70 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {(item.country_code ?? 'KE').toUpperCase()} · real {item.currency} balance
                  </p>
                </div>
                <span className={cn('mt-1 h-2.5 w-2.5 rounded-full', status.color)} />
              </div>
              <p className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(item.balance, item.currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Last synced {formatStaleness(status.minutesAgo)}
              </p>
              {item.account_number && (
                <p className="mt-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                  Acct {item.account_number}
                </p>
              )}
              {item.supports_mpesa_deposit && item.paybill_number && (
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                  Paybill {item.paybill_number}
                </p>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/70 p-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Kenya Consolidated Display</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(kenyaConsolidatedKes, 'KES')}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            FX-converted display only. Real balances remain shown per account above.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/70 p-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Latest Cash Requirement</p>
          {latestForecast ? (
            <>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(latestForecast.total_required_amount, latestForecast.currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {latestForecast.country_code} · {latestForecast.employee_count} employees · {formatDate(latestForecast.forecast_date)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No forecast has been generated yet.</p>
          )}
        </div>
      </div>

      {reconciliationFlags.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg space-y-3">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                Unconfirmed Stanbic Deposit{reconciliationFlags.length > 1 ? 's' : ''}
              </h3>
              <p className="text-sm text-red-800 dark:text-red-200">
                {reconciliationFlags.length} manually-recorded deposit{reconciliationFlags.length > 1 ? 's are' : ' is'} still not reflected in Stanbic&apos;s real balance more than 24 hours after being recorded. Verify against the bank statement before trusting this balance.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {reconciliationFlags.map((flag) => (
              <div
                key={flag.id}
                className="flex items-center justify-between gap-3 p-3 bg-white/60 dark:bg-slate-900/40 rounded-lg border border-red-200/50 dark:border-red-800/30"
              >
                <div className="text-sm">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(flag.recorded_amount, 'USD')}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400"> recorded {formatDateTime(flag.created_at)} — Stanbic reported {formatCurrency(flag.stanbic_reported_balance, 'USD')} vs. expected {formatCurrency(flag.balance_before_sync, 'USD')}</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleResolveFlag(flag.id, 'dismissed')}
                    disabled={resolvingFlagId === flag.id}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleResolveFlag(flag.id, 'resolved')}
                    disabled={resolvingFlagId === flag.id}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                  >
                    {resolvingFlagId === flag.id ? 'Confirming…' : 'Confirm Genuine'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {syncConflict && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">Sync Warning</h3>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Stanbic returned a balance of <span className="font-semibold">${syncConflict.incoming.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>, which is more than 50% lower than the current recorded balance of <span className="font-semibold">${syncConflict.previous.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>. The balance has NOT been updated. Please reconcile manually before proceeding.
            </p>
          </div>
          <button
            onClick={() => setSyncConflict(null)}
            className="text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800/50 p-1 rounded transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {isLowBalance && wallet && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">Low Balance Warning</h3>
            <p className="text-sm text-red-800 dark:text-red-200">
              The Main Stanbic Source balance ({formatCurrency(wallet.balance, wallet.currency)}) is at or below the configured low-balance threshold ({formatCurrency(lowBalanceThresholdUsd ?? 0, 'USD')}). Approving a debit_order/invoice employer&apos;s top-up will require explicit confirmation until this is resolved — either record a new Stanbic deposit or adjust the threshold in Settings.
            </p>
          </div>
        </div>
      )}

      {syncStatus.isStale && (
        <div className={`p-3 rounded-lg flex items-center gap-3 border ${
          syncStatus.color === 'bg-red-500'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}>
          <AlertTriangle className={`w-4 h-4 shrink-0 ${
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
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0 disabled:opacity-50 ${
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
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
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

              <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-slate-200/70 dark:border-slate-700/50 bg-slate-50/60 dark:bg-slate-800/30 p-4">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Account</p>
                  <p className="mt-1 font-mono text-sm text-slate-900 dark:text-white">
                    {wallet.account_number ?? 'Not configured'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Bank</p>
                  <p className="mt-1 text-sm text-slate-900 dark:text-white">
                    {[wallet.bank_name, wallet.branch_name].filter(Boolean).join(' - ') || 'Not configured'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Codes</p>
                  <p className="mt-1 text-sm text-slate-900 dark:text-white">
                    Branch {wallet.branch_code ?? '-'} / Bank {wallet.bank_code ?? '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">SWIFT</p>
                  <p className="mt-1 font-mono text-sm text-slate-900 dark:text-white">
                    {wallet.swift_code ?? '-'}
                  </p>
                </div>
                {wallet.supports_mpesa_deposit && wallet.paybill_number && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">M-Pesa Deposit</p>
                    <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      Paybill {wallet.paybill_number} for KES deposits only
                    </p>
                  </div>
                )}
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
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
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
          transactions={selectedTransactions}
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
        walletCurrency={wallet?.currency ?? 'USD'}
        walletId={wallet?.id}
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
