import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Admin API: Record a deposit from the real Stanbic Bank account into the platform's virtual source.
 * This represents the actual cash available for disbursements.
 */
export async function POST(req: NextRequest) {
  try {
    const { amount, reference, description } = await req.json();

    if (!amount) {
      return NextResponse.json({ error: 'Missing amount' }, { status: 400 });
    }

    // 1. Get the Main Stanbic Source wallet
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('admin_wallets')
      .select('id')
      .eq('name', 'Main Stanbic Source')
      .single();

    if (walletError || !wallet) {
      throw new Error('Main Stanbic Source wallet not found');
    }

    // 2. Perform deposit
    const { error: txError } = await supabaseAdmin.rpc('admin_deposit', {
      p_wallet_id: wallet.id,
      p_amount: amount,
      p_reference: reference || `STANBIC-${Date.now()}`,
      p_description: description || 'Direct deposit from Stanbic Bank'
    });

    if (txError) throw txError;

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error(`[Stanbic Deposit] Error: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
