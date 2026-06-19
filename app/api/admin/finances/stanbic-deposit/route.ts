import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAccess } from '@/lib/server/admin-auth';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const adminAccess = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
    if (adminAccess.error || !adminAccess.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Stanbic Deposit] Error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
