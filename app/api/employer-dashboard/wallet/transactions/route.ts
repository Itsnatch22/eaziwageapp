import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/employer-dashboard/wallet/transactions
 * Returns a list of wallet transactions (funding and payouts) for the employer
 */
export async function GET() {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Get Employer
  const { data: employer } = await supabase
    .from('employer_onboarding')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!employer) {
    return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
  }

  // 2. Get Wallet
  const { data: wallet } = await supabase
    .from('employer_wallets')
    .select('id, balance, currency')
    .eq('employer_id', employer.id)
    .maybeSingle();

  if (!wallet) {
    return NextResponse.json({ transactions: [], balance: 0 });
  }

  // 3. Get Transactions
  const { data: transactions, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    balance: wallet.balance,
    currency: wallet.currency,
    transactions: transactions || []
  });
}
