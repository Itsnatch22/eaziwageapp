import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: employer } = await supabase
    .from('employers')
    .select('id, onboarding_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!employer) {
    return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
  }

  const { data: wallet } = await supabase
    .from('employer_wallets')
    .select('id, balance, currency')
    .eq('employer_id', employer.onboarding_id)
    .maybeSingle();

  if (!wallet) {
    return NextResponse.json({ transactions: [], balance: 0 });
  }

  const { data: transactions, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[employer-wallet-transactions] DB error:', error);
    return NextResponse.json({ error: 'Failed to fetch wallet transactions' }, { status: 500 });
  }

  return NextResponse.json({
    balance: wallet.balance,
    currency: wallet.currency,
    transactions: transactions || []
  });
}
