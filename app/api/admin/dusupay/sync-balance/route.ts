import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { dusupayClient } from '@/lib/dusupay/client';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAccess } from '@/lib/server/admin-auth';

export async function POST() {

  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const adminAccess = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
    if (adminAccess.error || !adminAccess.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const balances = await dusupayClient.getWalletBalances();

    if (balances.code !== 200) {
      throw new Error(`DusuPay API returned code ${balances.code}`);
    }

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

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[DusuPay Sync] Error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
