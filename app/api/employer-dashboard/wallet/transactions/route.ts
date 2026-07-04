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
    return NextResponse.json({ transactions: [], balance: 0 });
  }

  const { data: wallet } = await supabase
    .from('employer_wallets')
    .select('id, outstanding_liability, total_advanced, total_repaid, reserved_amount, currency')
    .eq('employer_id', employer.id)
    .maybeSingle();

  if (!wallet) {
    return NextResponse.json({ transactions: [], balance: 0 });
  }

  // 'reservation' rows are internal fund-hold bookkeeping (reserve_employer_funds),
  // not a real money event — excluded for the same reason as /wallet's GET handler.
  const { data: transactions, error } = await supabase
    .from('wallet_transactions')
    .select('id, wallet_id, amount, type, status, description, reference, created_at')
    .eq('wallet_id', wallet.id)
    .neq('type', 'reservation')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[employer-wallet-transactions] DB error:', error);
    return NextResponse.json({ error: 'Failed to fetch wallet transactions' }, { status: 500 });
  }

  // Same canonical formula as /wallet and the admin Billing/topup-requests pages —
  // previously summed only the most recent 100 transactions, which disagreed with
  // /wallet's own (then 20-row) sum and understated balance for older wallets.
  const balance = Math.max(
    Number(wallet.total_advanced) - Number(wallet.total_repaid) - Number(wallet.reserved_amount ?? 0),
    0,
  );

  return NextResponse.json({
    balance,
    currency: wallet.currency,
    transactions: (transactions || []).map(tx => ({ ...tx, transaction_type: tx.type })),
  });
}
