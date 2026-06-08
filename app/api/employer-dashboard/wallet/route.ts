import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { getCurrencyFromCountry } from '@/lib/utils';
import { createRouteHandlerClient } from '@/utils/supabase/server';

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get Employer Record (must be approved and not deleted)
    const { data: employer, error: employerError } = await adminSupabase
      .from('employers')
      .select('id, status, onboarding_id, employer_onboarding!onboarding_id(country, currency, deleted_at)')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (employerError) {
      console.error('[Wallet API] Employer fetch error:', employerError);
      return NextResponse.json({ error: 'Failed to fetch employer data' }, { status: 500 });
    }

    if (!employer) {
      // Check if employer exists but is not approved or was deleted
      const { data: anyEmployer } = await adminSupabase
        .from('employers')
        .select('id, status, onboarding_id, employer_onboarding!onboarding_id(country, currency, deleted_at)')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!anyEmployer) {
        return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
      }
      
      const anyOnboarding = Array.isArray(anyEmployer.employer_onboarding)
        ? anyEmployer.employer_onboarding[0]
        : anyEmployer.employer_onboarding;

      if (anyOnboarding?.deleted_at) {
        return NextResponse.json({ error: 'Account has been terminated' }, { status: 403 });
      }
      
      return NextResponse.json({ error: 'Employer not approved. Please complete onboarding.' }, { status: 403 });
    }
    const onboarding = Array.isArray(employer.employer_onboarding)
      ? employer.employer_onboarding[0]
      : employer.employer_onboarding;

    if (onboarding?.deleted_at) {
      return NextResponse.json({ error: 'Account has been terminated' }, { status: 403 });
    }

    // 2. Get Wallet
    const { data: wallet, error: walletError } = await adminSupabase
      .from('employer_wallets')
      .select('*')
      .eq('employer_id', employer.onboarding_id)
      .maybeSingle();

    if (walletError) throw walletError;

    // 3. If no wallet exists, create one (lazy creation)
    let currentWallet = wallet;
    if (!wallet) {
      const walletCurrency = onboarding?.currency || getCurrencyFromCountry(onboarding?.country, 'KES');

      const { data: newWallet, error: createError } = await adminSupabase
        .from('employer_wallets')
        .insert({
          employer_id: employer.onboarding_id,
          balance: 0,
          arrears_balance: 0,
          currency: walletCurrency
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

  } catch (error: unknown) {
    console.error('[Wallet API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
