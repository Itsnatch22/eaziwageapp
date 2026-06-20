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
      const anyResp = await adminSupabase
        .from('employers')
        .select('id, status, onboarding_id, employer_onboarding!onboarding_id(country, currency, deleted_at)')
        .eq('user_id', user.id)
        .maybeSingle();

      const anyEmployer = (anyResp.data ?? null) as unknown as Record<string, unknown> | null;
      if (!anyEmployer) {
        return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
      }

      const anyOnboardingRaw = anyEmployer['employer_onboarding'] as unknown;
      const anyOnboarding = Array.isArray(anyOnboardingRaw)
        ? (anyOnboardingRaw[0] as Record<string, unknown>)
        : (anyOnboardingRaw as Record<string, unknown> | undefined);

      if (anyOnboarding?.['deleted_at']) {
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

export async function POST(req: Request) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve employer (same rules as GET)
    const { data: employer, error: employerError } = await adminSupabase
      .from('employers')
      .select('id, status, onboarding_id, employer_onboarding!onboarding_id(country, currency, deleted_at)')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (employerError) {
      console.error('[Wallet POST] Employer lookup failed:', employerError);
      return NextResponse.json({ error: 'Failed to fetch employer data' }, { status: 500 });
    }

    if (!employer) {
      return NextResponse.json({ error: 'Employer not approved. Please complete onboarding.' }, { status: 403 });
    }

    const onboarding = Array.isArray(employer.employer_onboarding) ? employer.employer_onboarding[0] : employer.employer_onboarding;

    const body = await req.json().catch(() => null);
    const amount = Number(body?.amount ?? 0);
    if (!amount || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 422 });

    // Ensure wallet exists (lazy create)
    const { data: wallet, error: walletError } = await adminSupabase
      .from('employer_wallets')
      .select('*')
      .eq('employer_id', employer.onboarding_id)
      .maybeSingle();

    if (walletError) return NextResponse.json({ error: 'Wallet lookup failed' }, { status: 500 });

    let currentWallet = wallet;
    if (!wallet) {
      const walletCurrency = onboarding?.currency || getCurrencyFromCountry(onboarding?.country, 'KES');
      const { data: newWallet, error: createError } = await adminSupabase
        .from('employer_wallets')
        .insert({ employer_id: employer.onboarding_id, balance: 0, arrears_balance: 0, currency: walletCurrency })
        .select()
        .single();
      if (createError) return NextResponse.json({ error: 'Failed to create wallet' }, { status: 500 });
      currentWallet = newWallet;
    }

    // Create a pending wallet_transactions row to represent the request
    const reference = `DEP-${employer.onboarding_id}-${Date.now()}`;
    
    // Fetch current exchange rate for employer's currency
    const employerCurrency = currentWallet.currency;
    const { data: rateRow } = await adminSupabase
      .from('exchange_rates')
      .select('rate_to_usd')
      .eq('currency_code', employerCurrency)
      .single();

    const rateSnapshot = rateRow?.rate_to_usd ?? null;
    const usdAmount = rateSnapshot ? Number((amount / rateSnapshot).toFixed(6)) : null;

    const txPayload = {
      wallet_id: currentWallet.id,
      amount: amount,
      type: 'deposit',
      status: 'pending',
      reference,
      description: 'Top-up request (pending admin approval)',
      local_currency: employerCurrency,
      rate_snapshot: rateSnapshot,
      usd_amount: usdAmount,
      metadata: { employer_id: employer.onboarding_id, requested_by: user.id, requested_at: new Date().toISOString() }
    } as unknown as Record<string, unknown>;

    const { data: inserted, error: insertError } = await adminSupabase
      .from('wallet_transactions')
      .insert(txPayload)
      .select()
      .single();

    if (insertError) {
      console.error('[Wallet POST] Insert wallet_transactions failed:', insertError);
      return NextResponse.json({ error: 'Failed to create top-up request' }, { status: 500 });
    }

    // Notify admins for review
    try {
      const { notifyAdmins } = await import('@/lib/notifications');
      await notifyAdmins({
        type: 'review_request',
        title: 'Employer Wallet Top-up Request',
        message: `Employer ${employer.id} requested a top-up of ${amount}. Review in admin dashboard.`,
        metadata: { wallet_transaction_id: inserted.id, employer_id: employer.onboarding_id, amount }
      });
    } catch (notifyErr) {
      console.error('[Wallet POST] notifyAdmins failed:', notifyErr);
    }

    return NextResponse.json({ success: true, request: inserted }, { status: 201 });
  } catch (err: unknown) {
    console.error('[Wallet POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
