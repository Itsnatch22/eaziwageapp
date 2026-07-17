import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { syncStanbicBalance } from '@/lib/stanbic/sync';
import { requestLogger } from '@/lib/logger';
import { dbErrorResponse } from '@/lib/api-errors';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdminWallet {
  id: string;
  name: string;
  balance: number;
  currency: string;
  last_reconciled_at: string | null;
  updated_at: string;
}

// ─── GET — read wallet + last 5 transactions ──────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const log = requestLogger('admin-wallet-sync-get', req);
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    const { data: wallet, error: walletError } = await adminSupabase
      .from('admin_wallets')
      .select('id, name, balance, currency, last_reconciled_at, updated_at')
      .eq('name', 'Main Stanbic Source')
      .maybeSingle<AdminWallet>();

    if (walletError) throw walletError;

    let transactions: Array<Record<string, unknown>> = [];
    if (wallet?.id) {
      const { data: txs, error: txError } = await adminSupabase
        .from('admin_wallet_transactions')
        .select('id, admin_wallet_id, amount, type, status, reference, description, metadata, created_at')
        .eq('admin_wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (txError) {
        log.warn('Failed to fetch transactions', { err: txError.message });
      } else if (txs) {
        transactions = txs;
      }
    }

    return NextResponse.json({ wallet: wallet ?? null, transactions });
  } catch (err: unknown) {
    log.error('Unhandled error', { err });
    return dbErrorResponse('admin/wallet/sync GET', err);
  }
}

// ─── POST — sync balance from Stanbic ─────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  const log = requestLogger('admin-wallet-sync-post', req);
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    const result = await syncStanbicBalance(adminSupabase, log);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, ...(result.details ? { raw: result.details, previous: (result.details as { previous?: number })?.previous, incoming: (result.details as { incoming?: number })?.incoming } : {}) },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, wallet: result.wallet, currencyAnomaly: result.currencyAnomaly });
  } catch (err: unknown) {
    log.error('Unhandled error', { err });
    return dbErrorResponse('admin/wallet/sync POST', err);
  }
}
