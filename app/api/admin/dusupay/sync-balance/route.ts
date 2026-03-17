import { NextRequest, NextResponse } from 'next/server';
import { dusupayClient } from '@/lib/dusupay/client';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Admin API: Sync DusuPay API balance with the local mirror table.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Fetch balance from DusuPay API
    const balances = await dusupayClient.getWalletBalances();

    if (balances.code !== 200) {
      throw new Error(`DusuPay API returned code ${balances.code}`);
    }

    // 2. Update local mirror table
    for (const balance of balances.data) {
      await supabaseAdmin
        .from('dusupay_wallet_mirror')
        .upsert({
          currency: balance.currency,
          balance: balance.wallet_balance,
          last_sync_at: new Date().toISOString()
        }, { onConflict: 'currency' });
    }

    return NextResponse.json({ success: true, data: balances.data });

  } catch (err: any) {
    console.error(`[DusuPay Sync] Error: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
