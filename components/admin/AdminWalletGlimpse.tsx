import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils';

interface WalletRow {
  id: string;
  name: string;
  currency: string;
  balance: number;
  last_reconciled_at: string | null;
}

export default function AdminWalletGlimpse() {
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchWallet = async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const res = await fetch('/api/admin/wallet/sync');
      if (res.ok) {
        const data = await res.json();
        if (data && data.wallet) {
          setWallet(data.wallet as WalletRow);
        }
      }
    } catch (err) {
      console.error('Failed to fetch admin wallet glimpse:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchWallet({ silent: true });
  }, []);

  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-slate-500">{wallet?.name ?? 'Admin Stanbic Wallet'}</p>
          <p className="font-semibold text-slate-900 dark:text-white mt-1">{wallet ? `${wallet.currency} ${formatCurrency(wallet.balance, wallet.currency)}` : '—'}</p>
        </div>
        <Link href="/admin/wallet" className="text-xs text-green-600 hover:underline">View</Link>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div>{/* intentionally blank for alignment */}</div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{wallet?.last_reconciled_at ? formatDateTime(wallet.last_reconciled_at) : (loading ? 'Loading...' : 'Never')}</span>
        </div>
      </div>
    </div>
  );
}
