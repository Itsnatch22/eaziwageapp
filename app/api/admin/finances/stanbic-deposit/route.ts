import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { amount, reference, description } = await req.json();

    if (!amount) {
      return NextResponse.json({ error: 'Missing amount' }, { status: 400 });
    }

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('admin_wallets')
      .select('id')
      .eq('name', 'Main Stanbic Source')
      .single();

    if (walletError || !wallet) {
      throw new Error('Main Stanbic Source wallet not found');
    }

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
