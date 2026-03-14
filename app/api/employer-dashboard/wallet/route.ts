import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get Employer Record
    const { data: employer, error: employerError } = await adminSupabase
      .from('employer_onboarding')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (employerError || !employer) {
      return NextResponse.json({ error: 'Approved employer not found' }, { status: 403 });
    }

    // 2. Get Wallet
    const { data: wallet, error: walletError } = await adminSupabase
      .from('employer_wallets')
      .select('*')
      .eq('employer_id', employer.id)
      .maybeSingle();

    if (walletError) throw walletError;

    // 3. If no wallet exists, create one (lazy creation)
    let currentWallet = wallet;
    if (!wallet) {
      const { data: newWallet, error: createError } = await adminSupabase
        .from('employer_wallets')
        .insert({
          employer_id: employer.id,
          balance: 0,
          arrears_balance: 0,
          currency: 'KES'
        })
        .select()
        .single();
      
      if (createError) throw createError;
      currentWallet = newWallet;
    }

    // 4. Get recent transactions
    const { data: transactions, error: txError } = await adminSupabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', currentWallet.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (txError) throw txError;

    return NextResponse.json({
      wallet: currentWallet,
      transactions: transactions || []
    });

  } catch (error: any) {
    console.error('[Wallet API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
