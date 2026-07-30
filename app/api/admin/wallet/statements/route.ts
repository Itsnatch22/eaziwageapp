import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { fetchStanbicStatement } from '@/lib/stanbic/statements';
import { requestLogger } from '@/lib/logger';
import { dbErrorResponse } from '@/lib/api-errors';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const log = requestLogger('admin-wallet-statements-post', req);
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    const raw = await req.json().catch(() => ({})) as { wallet_id?: string; from_date?: string; to_date?: string; no_of_txns?: string };
    if (!raw.wallet_id || !raw.from_date || !raw.to_date) {
      return NextResponse.json({ error: 'wallet_id, from_date, and to_date are required (YYYYMMDD)' }, { status: 400 });
    }

    const { data: wallet, error: walletError } = await adminSupabase
      .from('admin_wallets')
      .select('id, currency')
      .eq('id', raw.wallet_id)
      .maybeSingle();

    if (walletError) throw walletError;
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const result = await fetchStanbicStatement(adminSupabase, log, {
      walletId: wallet.id,
      currency: wallet.currency,
      fromDate: raw.from_date,
      toDate: raw.to_date,
      noOfTxns: raw.no_of_txns,
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, inserted: result.inserted, zeroRecords: result.zeroRecords ?? false });
  } catch (err: unknown) {
    log.error('Unhandled error', { err });
    return dbErrorResponse('admin/wallet/statements POST', err);
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const log = requestLogger('admin-wallet-statements-get', req);
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    const walletId = req.nextUrl.searchParams.get('wallet_id');
    if (!walletId) return NextResponse.json({ error: 'wallet_id is required' }, { status: 400 });

    const { data, error } = await adminSupabase
      .from('stanbic_statement_transactions')
      .select('*')
      .eq('admin_wallet_id', walletId)
      .order('booking_date', { ascending: false })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ transactions: data ?? [] });
  } catch (err: unknown) {
    log.error('Unhandled error', { err });
    return dbErrorResponse('admin/wallet/statements GET', err);
  }
}