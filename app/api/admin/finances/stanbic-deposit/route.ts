import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    const { amount, reference, description } = await req.json();

    if (!amount) {
      return NextResponse.json({ error: 'Missing amount' }, { status: 400 });
    }

    const { data: wallet, error: walletError } = await adminSupabase
      .from('admin_wallets')
      .select('id')
      .eq('name', 'Main Stanbic Source')
      .single();

    if (walletError || !wallet) {
      throw new Error('Main Stanbic Source wallet not found');
    }

    const { error: txError } = await adminSupabase.rpc('admin_deposit', {
      p_wallet_id: wallet.id,
      p_amount: amount,
      p_reference: reference || `STANBIC-${Date.now()}`,
      p_description: description || 'Direct deposit from Stanbic Bank'
    });

    if (txError) throw txError;

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Stanbic Deposit] Error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
