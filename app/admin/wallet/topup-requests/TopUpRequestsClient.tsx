'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { AlertCircle, Wallet, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type RiskRating = 'low' | 'medium' | 'high' | 'critical';
type LocalCurrency = 'KES' | 'UGX' | 'TZS' | 'RWF';
type TopUpStatus = 'pending' | 'completed' | 'failed';

interface TopUpRequestMetadata {
  employer_id: string;
  requested_by: string;
  requested_at: string;
  approved_by?: string;
  approved_at?: string;
}

interface TopUpRequest {
  id: string;
  wallet_id: string;
  amount: number;
  usd_amount: number | null;
  rate_snapshot: number | null;
  local_currency: LocalCurrency | null;
  status: TopUpStatus;
  reference: string | null;
  description: string | null;
  metadata: TopUpRequestMetadata;
  created_at: string;
  employer_id: string;
  company_name: string;
  company_code: string;
  country: string;
  contact_person: string | null;
  risk_score: number | null;
  risk_rating: RiskRating | null;
  current_wallet_balance: number;
  wallet_currency: string;
}

interface AdminWallet {
  id: string;
  name: string;
  balance: number;
  currency: 'USD';
  last_reconciled_at: string | null;
}

interface TopUpRequestsClientProps {
  initialRequests: TopUpRequest[];
  initialAdminWallet: AdminWallet;
}

const COUNTRY_FLAGS: Record<string, string> = {
  Kenya: '🇰🇪',
  Uganda: '🇺🇬',
  Tanzania: '🇹🇿',
  Rwanda: '🇷🇼',
};

const RISK_COLORS: Record<RiskRating, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'KES',
    minimumFractionDigits: 2,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(amount);
}

function formatLocalCurrency(amount: number, currency: LocalCurrency): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency as unknown as string,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function formatAbsoluteDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

function isSyncStale(lastReconciled: string | null): boolean {
  if (!lastReconciled) return true;
  const lastSync = new Date(lastReconciled);
  const now = new Date();
  const hoursSince = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);
  return hoursSince > 24;
}

export default function TopUpRequestsClient({
  initialRequests,
  initialAdminWallet,
}: TopUpRequestsClientProps) {
  const [requests, setRequests] = useState<TopUpRequest[]>(initialRequests);
  const [adminWallet, setAdminWallet] = useState<AdminWallet>(initialAdminWallet);
  const [approving, setApproving] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/wallet/sync', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Sync failed');

      if (json.wallet) {
        setAdminWallet(prev => ({
          ...prev,
          balance: json.wallet.balance,
          last_reconciled_at: json.wallet.last_reconciled_at,
        }));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleApprove = useCallback(async (request: TopUpRequest) => {
    const usdAmount = request.usd_amount ?? 0;
    if (usdAmount > adminWallet.balance) {
      setError('Insufficient USD balance to approve this request.');
      return;
    }

    if (!window.confirm(`Approve $${usdAmount.toFixed(2)} for ${request.company_name}?`)) {
      return;
    }

    setApproving(prev => ({ ...prev, [request.id]: true }));
    setConfirmingId(null);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/wallet/topup-requests/${encodeURIComponent(request.id)}/approve`,
        { method: 'PATCH' }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Approval failed');

      setRequests(prev => prev.filter(r => r.id !== request.id));
      setAdminWallet(prev => ({
        ...prev,
        balance: prev.balance - (request.usd_amount ?? 0),
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setApproving(prev => ({ ...prev, [request.id]: false }));
    }
  }, [adminWallet.balance]);

  const insufficientFundsRequests = useMemo(
    () => new Set(requests.filter(r => (r.usd_amount ?? 0) > adminWallet.balance).map(r => r.id)),
    [requests, adminWallet.balance]
  );

  const isBalanceStale = isSyncStale(adminWallet.last_reconciled_at);

  return (
    <div className="space-y-8">
      {/* Admin Wallet Balance Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">EaziWage USD Wallet</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(adminWallet.balance, 'USD')}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">Available balance</span>
            </div>
          </div>
          <Wallet className="w-8 h-8 text-emerald-600" />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {adminWallet.last_reconciled_at ? (
              <>
                <span>Last synced: </span>
                <time title={formatAbsoluteDate(adminWallet.last_reconciled_at)}>
                  {formatRelativeTime(adminWallet.last_reconciled_at)}
                </time>
              </>
            ) : (
              <span>Never synced</span>
            )}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              syncing
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50'
            )}
          >
            <Zap className="w-4 h-4" />
            {syncing ? 'Syncing…' : 'Sync Balance'}
          </button>
        </div>

        {isBalanceStale && (
          <Alert className="mt-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            <AlertDescription className="text-amber-800 dark:text-amber-300">
              Balance not recently synced. Approve with caution.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <Alert className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-500" />
          <AlertDescription className="text-red-800 dark:text-red-300">{error}</AlertDescription>
        </Alert>
      )}

      {/* Top-Up Requests Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Pending Top-Up Requests
          </h3>
        </div>

        {requests.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Wallet className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-400">No pending top-up requests.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Requested
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Local Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">
                    USD Equivalent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Exchange Rate
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Current Wallet
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Risk
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const isInsufficient = insufficientFundsRequests.has(request.id);
                  const isApproving = approving[request.id];
                  const isConfirming = confirmingId === request.id;

                  return (
                    <tr
                      key={request.id}
                      className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {request.company_name}
                            </span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-medium">
                              {request.company_code}
                            </span>
                            <span className="text-lg">{COUNTRY_FLAGS[request.country] || '🌍'}</span>
                          </div>
                          {request.contact_person && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {request.contact_person}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <div className="text-sm">
                            <div className="text-slate-900 dark:text-white font-medium">
                              {formatRelativeTime(request.created_at)}
                            </div>
                            <time
                              className="text-xs text-slate-500 dark:text-slate-400"
                              title={formatAbsoluteDate(request.created_at)}
                            >
                              {formatAbsoluteDate(request.created_at)}
                            </time>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {request.local_currency
                            ? formatLocalCurrency(request.amount, request.local_currency)
                            : request.amount}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        {request.usd_amount !== null ? (
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(request.usd_amount, 'USD')}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-sm" title="Rate not captured at request time">
                            —
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {request.rate_snapshot ? (
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            1 USD = {request.rate_snapshot.toFixed(2)} {request.local_currency}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-sm">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {formatCurrency(request.current_wallet_balance, request.wallet_currency as unknown as string)}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-center">
                        {request.risk_rating && (
                          <span
                            className={cn(
                              'inline-block px-3 py-1 rounded-full text-xs font-semibold border',
                              RISK_COLORS[request.risk_rating].bg,
                              RISK_COLORS[request.risk_rating].text,
                              RISK_COLORS[request.risk_rating].border
                            )}
                          >
                            {request.risk_rating.charAt(0).toUpperCase() + request.risk_rating.slice(1)}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {isConfirming ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApprove(request)}
                              disabled={isApproving || isInsufficient}
                              className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-all',
                                isApproving || isInsufficient
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                  : 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-950/50'
                              )}
                            >
                              {isApproving ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-green-700 dark:border-green-400 border-t-transparent rounded-full animate-spin" />
                                  Approving…
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  Confirm
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => setConfirmingId(null)}
                              disabled={isApproving}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                            >
                              <XCircle className="w-4 h-4" />
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingId(request.id)}
                            disabled={isInsufficient || isApproving}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all',
                              isInsufficient || isApproving
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-950/50'
                            )}
                            title={isInsufficient ? 'Insufficient USD balance' : undefined}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
