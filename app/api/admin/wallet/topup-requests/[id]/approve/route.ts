import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { dbErrorResponse } from '@/lib/api-errors';
import { dusupayClient, DusupayNetworkError } from '@/lib/dusupay/client';
import { PayoutMethod, Currency } from '@/lib/dusupay/types';
import { resolveProviderCode, formatPhoneNumber, COUNTRY_PROVIDER_PREFIXES } from '@/lib/dusupay/utils';
import { notifyAdmin, notifyEmployer } from '@/lib/notifications';
import { getEnv } from '@/env';

export const runtime = 'nodejs';

interface TopupTx {
  id: string;
  wallet_id: string;
  amount: number;
  type: string;
  status: string;
  reference: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  local_currency: string | null;
  usd_amount: number | null;
  rate_snapshot: number | null;
}

interface EmployerRow {
  id: string;
  user_id: string | null;
  company_name: string | null;
  contact_person: string | null;
  currency: string | null;
  country: string | null;
  funding_model: string | null;
  mobile_money_provider: string | null;
  mobile_money_number: string | null;
  bank_name: string | null;
  bank_account_number: unknown; // encrypted bytea — never read directly, only via the decrypt RPC
}

export async function PATCH(
  _request: NextRequest,
  context: IdRouteContext
) {
  const { id } = await context.params;
  try {
    const rateLimitResponse = await checkAdminRateLimit(_request);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;

    const { data: tx, error: txError } = await adminSupabase
      .from('wallet_transactions')
      .select('id, wallet_id, amount, type, status, reference, description, metadata, local_currency, usd_amount, rate_snapshot')
      .eq('id', id)
      .maybeSingle() as { data: TopupTx | null; error: unknown };

    if (txError) throw txError;
    if (!tx) return NextResponse.json({ error: 'Top-up request not found' }, { status: 404 });

    if (tx.type !== 'deposit' || tx.status !== 'pending') {
      return NextResponse.json({ error: 'Transaction is not a pending deposit request' }, { status: 422 });
    }

    let employerId: string | undefined = undefined;
    if (tx.metadata && typeof tx.metadata === 'object' && 'employer_id' in tx.metadata) {
      const rawEmployerId = (tx.metadata as Record<string, unknown>).employer_id;
      if (typeof rawEmployerId === 'string') employerId = rawEmployerId;
    }

    if (!employerId) {
      const { data: walletRow, error: walletErr } = await adminSupabase
        .from('employer_wallets')
        .select('employer_id')
        .eq('id', tx.wallet_id)
        .maybeSingle();
      if (walletErr) throw walletErr;
      employerId = walletRow?.employer_id as string | undefined;
    }

    if (!employerId) return NextResponse.json({ error: 'Unable to resolve employer for this top-up request' }, { status: 500 });

    const { data: employer, error: employerErr } = await adminSupabase
      .from('employers')
      .select('id, user_id, company_name, contact_person, currency, country, funding_model, mobile_money_provider, mobile_money_number, bank_name, bank_account_number')
      .eq('id', employerId)
      .maybeSingle() as { data: EmployerRow | null; error: unknown };

    if (employerErr) throw employerErr;
    if (!employer) return NextResponse.json({ error: 'Employer not found' }, { status: 404 });

    const fundingModel = employer.funding_model ?? 'prefunded';
    const currency = (tx.local_currency || employer.currency || 'KES') as Currency;

    const updatedMetadata = Object.assign({}, tx.metadata ?? {}, { approved_by: user.id, approved_at: new Date().toISOString() });

    // Notify-on-ambiguous-failure helper — shared by both legs. A
    // DusupayNetworkError means we genuinely don't know whether DusuPay
    // processed the request, so the row is left exactly as the atomic claim
    // set it (status 'processing', reference stamped) rather than marked
    // failed — reconciliation or the eventual webhook resolves it. Never
    // auto-retried, never surfaced as a retry-eligible failure to the admin.
    const handleAmbiguousFailure = async (kind: 'collection' | 'payout', err: DusupayNetworkError) => {
      void notifyAdmin({
        type: 'system_alert',
        title: `Top-Up ${kind === 'collection' ? 'Collection' : 'Payout'} Outcome Unknown`,
        message: `DusuPay ${kind} request for ${employer.company_name || employerId} (top-up ${id}) did not receive a response. Outcome is unknown — do not retry manually. Awaiting reconciliation.`,
        metadata: { wallet_transaction_id: id, employer_id: employerId, error: err.message },
      }).catch(() => {});
      return NextResponse.json(
        { success: true, processing: true, ambiguous: true, request_id: id, message: 'Request sent to DusuPay but no confirmation was received. Status left as processing — do not retry; this will resolve via reconciliation or DusuPay\'s webhook.' },
        { status: 202 },
      );
    };

    const handleExplicitFailure = async (kind: 'collection' | 'payout', reason: string) => {
      await adminSupabase.from('wallet_transactions').update({
        status: 'failed',
        metadata: Object.assign({}, updatedMetadata, { failure_reason: reason }),
      }).eq('id', id);

      void notifyAdmin({
        type: 'system_alert',
        title: `Top-Up ${kind === 'collection' ? 'Collection' : 'Payout'} Failed`,
        message: `DusuPay ${kind} request for ${employer.company_name || employerId} (top-up ${id}) was rejected: ${reason}`,
        metadata: { wallet_transaction_id: id, employer_id: employerId, reason },
      }).catch(() => {});

      return NextResponse.json({ error: reason }, { status: 502 });
    };

    if (fundingModel === 'prefunded') {
      // Collection leg: the employer pays their own money into EaziWage via
      // DusuPay. Only mobile money is supported here (matches the payday-
      // recoupment collection pattern — DusuPay collections are mobile-money
      // only in this codebase's existing usage).
      if (!employer.mobile_money_provider || !employer.mobile_money_number) {
        return NextResponse.json(
          { error: 'Employer has no mobile money number on file. Ask them to set one in Settings before approving.' },
          { status: 422 },
        );
      }

      const providerCode = resolveProviderCode(employer.country, employer.mobile_money_provider);
      if (!providerCode) {
        return NextResponse.json(
          { error: `Unrecognized mobile money provider "${employer.mobile_money_provider}" on file — cannot resolve a DusuPay provider code.` },
          { status: 422 },
        );
      }

      const dialCode = COUNTRY_PROVIDER_PREFIXES[employer.country ?? ''] ?? '254';
      const msisdn = formatPhoneNumber(employer.mobile_money_number, dialCode);
      const merchantReference = `DEP-${employerId}-${Date.now()}`;

      const { data: claimed, error: claimErr } = await adminSupabase
        .from('wallet_transactions')
        .update({ status: 'processing', reference: merchantReference, metadata: updatedMetadata })
        .eq('id', id)
        .eq('status', 'pending')
        .is('reference', null)
        .select('id')
        .maybeSingle();

      if (claimErr) throw claimErr;
      if (!claimed) return NextResponse.json({ error: 'This request was already actioned.' }, { status: 409 });

      try {
        await dusupayClient.initializeCollection({
          merchant_reference: merchantReference,
          transaction_method: PayoutMethod.MOBILE_MONEY,
          currency,
          amount: Number(tx.amount),
          provider_code: providerCode,
          msisdn,
          customer_name: employer.company_name || 'EaziWage Employer',
          description: tx.description || `EaziWage wallet top-up: ${employer.company_name || employerId}`,
          charge_customer: false,
          allow_final_status_change: true,
        });
      } catch (err: unknown) {
        if (err instanceof DusupayNetworkError) return handleAmbiguousFailure('collection', err);
        const reason = err instanceof Error ? err.message : 'Collection request failed';
        return handleExplicitFailure('collection', reason);
      }

      void adminSupabase.from('system_audit_logs').insert({
        admin_id: user.id,
        admin_name: user.email,
        target_id: id,
        target_type: 'wallet_transaction',
        action: 'topup_collection_initiated',
        old_value: { status: 'pending' },
        new_value: { status: 'processing', merchant_reference: merchantReference },
        metadata: { employer_id: employerId, amount: tx.amount, currency },
      }).then(({ error }) => { if (error) console.error('[audit] topup_collection_initiated:', error); });

      if (employer.user_id) {
        void notifyEmployer({
          userId: employer.user_id,
          type: 'wallet_topup_approved',
          title: 'Wallet Top-Up Collection Initiated',
          message: `Your wallet top-up of ${currency} ${Number(tx.amount).toLocaleString()} has been approved. Check your phone to confirm the mobile money payment.`,
          metadata: { wallet_transaction_id: id, amount: tx.amount, currency, companyName: employer.company_name },
        }).catch(() => {});
      }

      return NextResponse.json({ success: true, processing: true, request_id: id, merchant_reference: merchantReference });
    }

    // Payout leg (debit_order / invoice): EaziWage sends the employer real
    // cash via DusuPay, collected back later at payday through the existing,
    // unchanged recoupment flow. Prefer bank, fall back to mobile money.
    //
    // usd_amount/rate_snapshot are captured once at request time and are
    // null if the exchange_rates lookup failed then. The webhook's eventual
    // fund_employer_from_admin call needs a real USD figure to debit the
    // admin wallet correctly — falling back to tx.amount there would deduct
    // the local-currency number as if it were already USD (same bug fixed
    // for the ledger-only flow earlier this session). Check before ever
    // initiating a real payout, not just before crediting it.
    if (tx.usd_amount === null || tx.rate_snapshot === null) {
      return NextResponse.json(
        { error: 'This request has no USD exchange-rate snapshot (rate lookup failed at request time). Cannot safely approve — refresh exchange rates and ask the employer to resubmit the request.' },
        { status: 422 },
      );
    }

    const { PII_ENCRYPTION_KEY } = getEnv();
    let payoutMethod: PayoutMethod;
    let providerCode: string | null = null;
    let accountNumber: string | null = null;

    if (employer.bank_name && employer.bank_account_number) {
      payoutMethod = PayoutMethod.BANK;
      // provider_code = raw bank name, unresolved — mirrors the existing,
      // documented-as-unverified precedent for employee bank-transfer payouts
      // in lib/services/payout-service.ts (no bank_code lookup exists there either).
      providerCode = employer.bank_name;
      const { data: decrypted, error: decryptErr } = await adminSupabase.rpc('admin_get_employer_live_bank_account', {
        p_employer_id: employerId,
        p_key: PII_ENCRYPTION_KEY,
      });
      if (decryptErr) throw decryptErr;
      accountNumber = (decrypted as string | null) ?? null;
    } else if (employer.mobile_money_provider && employer.mobile_money_number) {
      payoutMethod = PayoutMethod.MOBILE_MONEY;
      providerCode = resolveProviderCode(employer.country, employer.mobile_money_provider);
      const dialCode = COUNTRY_PROVIDER_PREFIXES[employer.country ?? ''] ?? '254';
      accountNumber = formatPhoneNumber(employer.mobile_money_number, dialCode);
    } else {
      return NextResponse.json(
        { error: 'Employer has no bank account or mobile money number on file. Ask them to set one in Settings before approving.' },
        { status: 422 },
      );
    }

    if (!providerCode || !accountNumber) {
      return NextResponse.json(
        { error: 'Could not resolve a valid payout destination for this employer (unrecognized provider or missing/undecryptable account details).' },
        { status: 422 },
      );
    }

    const merchantReference = `EWA-FUND-${employerId}-${Date.now()}`;

    const { data: claimed, error: claimErr } = await adminSupabase
      .from('wallet_transactions')
      .update({ status: 'processing', reference: merchantReference, metadata: updatedMetadata })
      .eq('id', id)
      .eq('status', 'pending')
      .is('reference', null)
      .select('id')
      .maybeSingle();

    if (claimErr) throw claimErr;
    if (!claimed) return NextResponse.json({ error: 'This request was already actioned.' }, { status: 409 });

    try {
      await dusupayClient.sendFunds({
        merchant_reference: merchantReference,
        transaction_method: payoutMethod,
        currency,
        amount: Number(tx.amount),
        provider_code: providerCode,
        account_number: accountNumber,
        customer_name: employer.company_name || 'EaziWage Employer',
        description: tx.description || `EaziWage wallet funding: ${employer.company_name || employerId}`,
      });
    } catch (err: unknown) {
      if (err instanceof DusupayNetworkError) return handleAmbiguousFailure('payout', err);
      const reason = err instanceof Error ? err.message : 'Payout request failed';
      return handleExplicitFailure('payout', reason);
    }

    // Ledger update (fund_employer_from_admin — real admin-fronted liability)
    // is deliberately deferred to the webhook confirming transaction.completed,
    // not run synchronously here. See app/api/webhook/dusupay/route.ts,
    // handleEmployerFundingPayout().
    void adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id,
      admin_name: user.email,
      target_id: id,
      target_type: 'wallet_transaction',
      action: 'topup_payout_initiated',
      old_value: { status: 'pending' },
      new_value: { status: 'processing', merchant_reference: merchantReference },
      metadata: { employer_id: employerId, amount: tx.amount, currency, payout_method: payoutMethod },
    }).then(({ error }) => { if (error) console.error('[audit] topup_payout_initiated:', error); });

    if (employer.user_id) {
      void notifyEmployer({
        userId: employer.user_id,
        type: 'wallet_topup_approved',
        title: 'Wallet Funding Payout Initiated',
        message: `Your wallet funding of ${currency} ${Number(tx.amount).toLocaleString()} has been approved and sent for payout. You'll be notified once it's confirmed.`,
        metadata: { wallet_transaction_id: id, amount: tx.amount, currency, companyName: employer.company_name },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, processing: true, request_id: id, merchant_reference: merchantReference });
  } catch (err: unknown) {
    return dbErrorResponse('admin/wallet/topup-requests/approve', err);
  }
}
