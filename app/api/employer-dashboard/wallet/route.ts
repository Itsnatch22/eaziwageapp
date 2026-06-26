import { NextResponse } from 'next/server';
import { getCurrencyFromCountry } from '@/lib/utils';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // employer_view_own_wallet + employers_can_read_own_record RLS — user-scoped client is sufficient
    const { data: employer, error: employerError } = await supabase
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
      const anyResp = await supabase
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

    // employer_view_own_wallet RLS covers this SELECT
    const { data: wallet, error: walletError } = await supabase
      .from('employer_wallets')
      .select('id, employer_id, total_advanced, outstanding_liability, total_repaid, currency, updated_at')
      .eq('employer_id', employer.id)
      .maybeSingle();

    if (walletError) throw walletError;

    let currentWallet = wallet;
    if (!wallet) {
      const walletCurrency = onboarding?.currency || getCurrencyFromCountry(onboarding?.country, 'KES');
      // Only admin RLS exists for employer_wallets INSERT — service-role required here
      const adminSupabase = createAdminClient();
      const { data: newWallet, error: createError } = await adminSupabase
        .from('employer_wallets')
        .insert({ employer_id: employer.id, total_advanced: 0, outstanding_liability: 0, total_repaid: 0, currency: walletCurrency, updated_at: new Date().toISOString() })
        .select('id, employer_id, total_advanced, outstanding_liability, total_repaid, currency, updated_at')
        .single();
      if (createError) throw createError;
      currentWallet = newWallet;
    }

    if (!currentWallet) throw new Error('Failed to initialize wallet');

    // employer_view_own_wallet_tx RLS covers this SELECT
    const { data: transactions, error: txError } = await supabase
      .from('wallet_transactions')
      .select('id, wallet_id, amount, type, status, description, reference, created_at')
      .eq('wallet_id', currentWallet.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (txError) throw txError;

    // Balance = net of all completed transactions (deposits positive, payouts negative)
    const balance = (transactions || []).reduce(
      (sum, tx) => (tx.status === 'completed' ? sum + Number(tx.amount) : sum),
      0,
    );

    return NextResponse.json({
      wallet: {
        ...currentWallet,
        balance,
        arrears_balance: Number(currentWallet.outstanding_liability),
      },
      transactions: (transactions || []).map(tx => ({ ...tx, transaction_type: tx.type })),
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

    const rate = await checkRateLimit(apiLimiter, `wallet-topup:${user.id}`);
    if (!rate.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    // employers_can_read_own_record + employer_view_own_wallet RLS — user-scoped client is sufficient
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, status, company_name, onboarding_id, employer_onboarding!onboarding_id(company_name, country, currency, deleted_at)')
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


    // employer_view_own_wallet RLS covers this SELECT
    const { data: wallet, error: walletError } = await supabase
      .from('employer_wallets')
      .select('id, employer_id, total_advanced, outstanding_liability, total_repaid, currency, updated_at')
      .eq('employer_id', employer.id)
      .maybeSingle();

    if (walletError) return NextResponse.json({ error: 'Wallet lookup failed' }, { status: 500 });

    let currentWallet = wallet;
    if (!wallet) {
      const walletCurrency = onboarding?.currency || getCurrencyFromCountry(onboarding?.country, 'KES');
      const { data: newWallet, error: createError } = await adminSupabase
        .from('employer_wallets')
        .insert({ employer_id: employer.id, total_advanced: 0, outstanding_liability: 0, total_repaid: 0, currency: walletCurrency, updated_at: new Date().toISOString() })
        .select('id, employer_id, total_advanced, outstanding_liability, total_repaid, currency, updated_at')
        .single();
      if (createError) return NextResponse.json({ error: 'Failed to create wallet' }, { status: 500 });
      currentWallet = newWallet;
    }

    if (!currentWallet) return NextResponse.json({ error: 'Failed to initialize wallet' }, { status: 500 });

    const reference = `DEP-${employer.id}-${Date.now()}`;
    

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
      metadata: { employer_id: employer.id, requested_by: user.id, requested_at: new Date().toISOString() }
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


    try {
      const { notifyAdmin } = await import('@/lib/notifications');
      await notifyAdmin({
        type: 'review_request',
        title: 'Employer Wallet Top-up Request',
        message: `${onboarding?.company_name || employer.company_name || 'An employer'} requested a wallet top-up of ${amount}. Review in admin dashboard.`,
        metadata: { wallet_transaction_id: inserted.id, employer_id: employer.id, amount }
      });
    } catch (notifyErr) {
      console.error('[Wallet POST] notifyAdmin failed:', notifyErr);
    }

    return NextResponse.json({ success: true, request: inserted }, { status: 201 });
  } catch (err: unknown) {
    console.error('[Wallet POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
