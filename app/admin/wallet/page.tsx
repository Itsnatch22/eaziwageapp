import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import AdminWalletClient from './AdminWalletClient';

interface ExchangeRate {
  currency_code: string;
  rate_to_usd: number;
  updated_at: string;
}

async function fetchInitialData() {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/wallet/sync`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch wallet data');
    }

    return await response.json();
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
  const [walletData, exchangeRates] = await Promise.all([
    fetchInitialData(),
    fetchExchangeRates(),
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Suspense fallback={<WalletSkeleton />}>
        <AdminWalletClient initialWallet={walletData.wallet} initialTransactions={walletData.transactions} exchangeRates={exchangeRates} />
      </Suspense>
    </div>
  );
}
