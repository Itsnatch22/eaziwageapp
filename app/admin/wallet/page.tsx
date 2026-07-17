import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import AdminWalletClient from './AdminWalletClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ExchangeRate {
  currency_code: string;
  rate_to_usd: number;
  updated_at: string;
}

async function fetchInitialData() {
  try {
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('admin_wallets')
      .select('id, name, balance, currency, last_reconciled_at, updated_at')
      .eq('name', 'Main Stanbic Source')
      .maybeSingle();

    if (walletError) throw walletError;

    let transactions: Array<Record<string, unknown>> = [];
    if (wallet?.id) {
      const { data: txs } = await supabaseAdmin
        .from('admin_wallet_transactions')
        .select('id, admin_wallet_id, amount, type, status, reference, description, metadata, created_at')
        .eq('admin_wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(5);
      transactions = (txs ?? []) as Array<Record<string, unknown>>;
    }

    return { wallet: wallet ?? null, transactions };
  } catch (error) {
    console.error('Error fetching wallet data:', error);
    return { wallet: null, transactions: [] };
  }
}

async function fetchExchangeRates(): Promise<ExchangeRate[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('exchange_rates')
      .select('currency_code, rate_to_usd, updated_at')
      .order('currency_code', { ascending: true });

    if (error) {
      console.error('Error fetching exchange rates:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return [];
  }
}

async function fetchLowBalanceThreshold(): Promise<number | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('global_settings')
      .select('platform_settings')
      .eq('id', 'default')
      .maybeSingle();

    if (error) {
      console.error('Error fetching low balance threshold:', error);
      return null;
    }

    const value = (data?.platform_settings as { low_balance_threshold_usd?: number } | null)?.low_balance_threshold_usd;
    return typeof value === 'number' ? value : null;
  } catch (error) {
    console.error('Error fetching low balance threshold:', error);
    return null;
  }
}

function WalletSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 py-6">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg w-64 animate-pulse" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/60 dark:bg-slate-900/60 rounded-2xl p-8 border border-slate-200/50 dark:border-slate-700/30 h-64 animate-pulse" />
        <div className="bg-white/60 dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 h-64 animate-pulse" />
      </div>

      <div className="bg-white/60 dark:bg-slate-900/60 rounded-2xl p-8 border border-slate-200/50 dark:border-slate-700/30 h-96 animate-pulse" />

      <div className="bg-white/60 dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 h-64 animate-pulse" />
    </div>
  );
}

export default async function AdminWalletPage() {
  const [walletData, exchangeRates, lowBalanceThresholdUsd] = await Promise.all([
    fetchInitialData(),
    fetchExchangeRates(),
    fetchLowBalanceThreshold(),
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Suspense fallback={<WalletSkeleton />}>
        <AdminWalletClient
          initialWallet={walletData.wallet}
          initialTransactions={walletData.transactions as never}
          exchangeRates={exchangeRates}
          lowBalanceThresholdUsd={lowBalanceThresholdUsd}
        />
      </Suspense>
    </div>
  );
}
