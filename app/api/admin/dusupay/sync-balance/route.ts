import { NextRequest, NextResponse } from 'next/server';
import { dusupayClient } from '@/lib/dusupay/client';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { dbErrorResponse } from '@/lib/api-errors';

export async function POST(req: NextRequest) {

  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    const balances = await dusupayClient.getWalletBalances();

    if (balances.code !== 200) {
      throw new Error(`DusuPay API returned code ${balances.code}`);
    }

    for (const balance of balances.data) {
      await adminSupabase
        .from('dusupay_wallet_mirror')
        .upsert({
          currency: balance.currency,
          balance: balance.wallet_balance,
          last_sync_at: new Date().toISOString()
        }, { onConflict: 'currency' });
    }

    return NextResponse.json({ success: true, data: balances.data });

  } catch (err: unknown) {
    return dbErrorResponse('admin/dusupay/sync-balance', err);
  }
}
