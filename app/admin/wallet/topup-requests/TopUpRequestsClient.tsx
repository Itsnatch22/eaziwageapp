'use client';

import React, { useState, useCallback } from 'react';
import { AlertCircle, Wallet, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type RiskRating = 'A' | 'B' | 'C' | 'D';
type LocalCurrency = 'KES' | 'UGX' | 'TZS' | 'RWF';
type TopUpStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'rejected';

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

interface TopUpRequestsClientProps {
  initialRequests: TopUpRequest[];
}

const COUNTRY_FLAGS: Record<string, string> = {
  Kenya: '🇰🇪',
  Uganda: '🇺🇬',
  Tanzania: '🇹🇿',
  Rwanda: '🇷🇼',
};

const RISK_GRADE: Record<RiskRating, { label: string; badge: string; pill: string }> = {
  A: { label: 'Low Risk',       badge: 'bg-emerald-500 text-white', pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
  B: { label: 'Medium Risk',    badge: 'bg-blue-500 text-white',    pill: 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
  C: { label: 'High Risk',      badge: 'bg-amber-500 text-white',   pill: 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
  D: { label: 'Very High Risk', badge: 'bg-red-500 text-white',     pill: 'bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
};

function formatCurrency(amount: number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined) return '—';
  const isUSD = currency === 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: isUSD ? 'USD' : 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: isUSD ? 2 : 0,
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

export default function TopUpRequestsClient({
  initialRequests,
}: TopUpRequestsClientProps) {
  const [requests, setRequests] = useState<TopUpRequest[]>(initialRequests);
  const [approving, setApproving] = useState<Record<string, boolean>>({});
  const [rejecting, setRejecting] = useState<Record<string, boolean>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = useCallback(async (request: TopUpRequest) => {
    setApproving(prev => ({ ...prev, [request.id]: true }));
    setConfirmingId(null);
    setError(null);

    // Approval is a ledger-only credit-line update (approve_employer_credit_line
    // RPC) — no DusuPay call, no admin_wallets balance touched, no cash moves.
    // There is nothing to check funds against here.
    try {
      const res = await fetch(
        `/api/admin/wallet/topup-requests/${encodeURIComponent(request.id)}/approve`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Approval failed');

      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setApproving(prev => ({ ...prev, [request.id]: false }));
    }
  }, []);

  const handleReject = useCallback(async (request: TopUpRequest) => {
    const reason = window.prompt(`Reason for declining ${request.company_name}'s top-up request:`);
    if (!reason?.trim()) return;

    setRejecting(prev => ({ ...prev, [request.id]: true }));
    setConfirmingId(null);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/wallet/topup-requests/${encodeURIComponent(request.id)}/reject`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason.trim() }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Rejection failed');

      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setRejecting(prev => ({ ...prev, [request.id]: false }));
    }
  }, []);

  return (
    <div className="space-y-8">
      {error && (
        <Alert className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-500" />
          <AlertDescription className="text-red-800 dark:text-red-300">{error}</AlertDescription>
        </Alert>
      )}

      
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
                  const isApproving = approving[request.id];
                  const isRejecting = rejecting[request.id];
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
                        {request.risk_rating && RISK_GRADE[request.risk_rating] ? (
                          <span className={cn('px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1', RISK_GRADE[request.risk_rating].pill)}>
                            <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold', RISK_GRADE[request.risk_rating].badge)}>
                              {request.risk_rating}
                            </span>
                            {RISK_GRADE[request.risk_rating].label}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {isConfirming ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApprove(request)}
                              disabled={isApproving}
                              className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-all',
                                isApproving
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                  : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-950/50'
                              )}
                            >
                              {isApproving ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-emerald-700 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
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
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleReject(request)}
                              disabled={isRejecting || isApproving}
                              className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-all',
                                isRejecting || isApproving
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                  : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50'
                              )}
                            >
                              {isRejecting ? (
                                <div className="w-3 h-3 border-2 border-red-700 dark:border-red-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                              Reject
                            </button>
                            <button
                              onClick={() => setConfirmingId(request.id)}
                              disabled={isApproving || isRejecting}
                              className={cn(
                                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all',
                                isApproving || isRejecting
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                  : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-950/50'
                              )}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Approve
                            </button>
                          </div>
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