import { NextRequest, NextResponse } from 'next/server';
import { dusupay } from '@/lib/dusupay';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyEmployee, notifyEmployer, notifyAdmin } from '@/lib/notifications';
import { parseRepaymentReference } from '@/lib/repayment/utils';
import { applyPaydayRecoupmentCollection } from '@/lib/services/payday-recoupment-service';
import { requestLogger, type Logger } from '@/lib/logger';
import { normalizeDusuPayStatus } from '@/lib/dusupay/webhook-status';

interface DusupayWebhookPayload {
  merchant_reference?: string;
  transaction_id?: string;
  internal_reference?: string;
  dusupay_reference?: string;
  transaction_status?: string;
  status?: string;
  transaction_amount?: number | string;
  transaction_currency?: string;
  net_amount?: number | string;
  charges?: number | string;
}

async function acquireWebhookClaim(
  merchantRef: string,
  event: string,
  internalRef: string,
  rawPayload: Record<string, unknown>,
): Promise<{ claimed: boolean; reason: string; claimToken?: string }> {
  const { data, error } = await supabaseAdmin.rpc('acquire_dusupay_webhook_claim', {
    p_merchant_reference: merchantRef,
    p_event_type: event,
    p_internal_reference: internalRef || null,
    p_payload: rawPayload,
  });

  if (error) throw new Error(`Failed to acquire DusuPay webhook claim: ${error.message}`);
  if (!data || typeof data !== 'object' || !('claimed' in data)) {
    throw new Error('DusuPay webhook claim RPC returned an invalid response');
  }

  const result = data as { claimed?: unknown; reason?: unknown; claim_token?: unknown };
  if (typeof result.claimed !== 'boolean') {
    throw new Error('DusuPay webhook claim RPC omitted the claimed result');
  }
  if (!result.claimed) {
    return { claimed: false, reason: String(result.reason ?? 'already_claimed') };
  }
  if (typeof result.claim_token !== 'string' || !result.claim_token) {
    throw new Error('DusuPay webhook claim RPC omitted its fencing token');
  }

  return {
    claimed: true,
    reason: String(result.reason ?? 'rpc'),
    claimToken: result.claim_token,
  };
}

async function finishWebhookClaim(
  merchantRef: string,
  event: string,
  claimToken: string,
  outcome: 'completed' | 'failed',
): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc('finish_dusupay_webhook_claim', {
    p_merchant_reference: merchantRef,
    p_event_type: event,
    p_claim_token: claimToken,
    p_outcome: outcome,
  });
  if (error) throw new Error(`Failed to ${outcome} DusuPay webhook claim: ${error.message}`);
  if (data !== true) throw new Error(`DusuPay webhook claim could not be marked ${outcome}`);
}

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-real-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()) ?? 'unknown';
  const log = requestLogger('webhook-dusupay', req).child({ ip });
  let activeClaim: { merchantReference: string; event: string; claimToken: string } | null = null;

  log.info('Webhook received');

  // Fail closed: a webhook without an allowlist is not trusted to move funds.
  try {
    const allowedIps = (process.env.DUSUPAY_ALLOWED_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (allowedIps.length === 0) {
      log.warn('DUSUPAY_ALLOWED_IPS not configured; webhook rejected', { ip });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!allowedIps.includes(ip)) {
      log.warn('Webhook IP not in allowed list', { ip });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch (e) {
    log.warn('Failed to parse DUSUPAY_ALLOWED_IPS; rejecting webhook', { err: e, ip });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('dusupay-signature') ?? '';

    if (!signature || !dusupay.verifyWebhookSignature(rawBody, signature)) {
      log.warn('Invalid or missing signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const { event, payload } = dusupay.parseWebhook(body) as { event: string; payload: DusupayWebhookPayload };

    const merchantReference = payload.merchant_reference || payload.transaction_id;
    const internalReference = payload.internal_reference || payload.dusupay_reference || '';
    const normalizedStatus = normalizeDusuPayStatus(event, payload);
    const amount = Number(payload.transaction_amount);
    const currency = payload.transaction_currency;

    if (normalizedStatus === 'REJECTED') {
      log.warn('Rejected contradictory DusuPay status payload', { event, merchantRef: merchantReference, payload });
      return NextResponse.json({ error: 'Contradictory webhook status' }, { status: 400 });
    }

    if (!Number.isFinite(amount)) {
      log.error('Webhook payload missing or invalid transaction_amount', { payload });
      return NextResponse.json({ error: 'Invalid transaction amount in payload' }, { status: 400 });
    }

    if (!merchantReference) {
      log.error('Missing merchant reference');
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
    }

    // Narrow context — every log line below includes event + merchantRef for easy correlation.
    const mlog = log.child({ event, merchantRef: merchantReference });

    const claim = await acquireWebhookClaim(merchantReference, event, internalReference, body);
    if (!claim.claimed) {
      mlog.info('Webhook already claimed by another worker — skipping', { reason: claim.reason });
      if (claim.reason !== 'already_completed') {
        return NextResponse.json(
          { error: 'Webhook processing is already in progress; retry later' },
          { status: 503, headers: { 'Retry-After': '30' } },
        );
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }
    if (!claim.claimToken) throw new Error('Claim token was not returned for an acquired DusuPay webhook');
    activeClaim = { merchantReference, event, claimToken: claim.claimToken };

    // DusuPay uses the SAME event names for both directions — "transaction.completed"
    // /"transaction.failed", never a "collection."-prefixed string (confirmed against
    // https://developer.dusupay.com/utility-functions/handling-notifications-callbacks/callback-events).
    // The only reliable signal for which flow a webhook belongs to is our own
    // merchant_reference prefix, which is what handleCollectionEvent already keys off
    // internally (DEP-/EWA-REP-/EWAPAYDAY) — route on it here too instead of `event`.
    const isCollection = merchantReference.startsWith('DEP-')
      || merchantReference.startsWith('EWA-REP-')
      || merchantReference.startsWith('EWAPAYDAY');

    if (isCollection) {
      await handleCollectionEvent(event, payload, merchantReference, internalReference, normalizedStatus, mlog);
    } else if (merchantReference.startsWith('EWA-FUND-')) {
      // Employer wallet funding payout (debit_order/invoice employers) — has
      // its own handler since handlePayoutEvent only knows about `advances`.
      await handleEmployerFundingPayout(event, payload, merchantReference, internalReference, normalizedStatus, mlog);
    } else {
      await handlePayoutEvent(event, payload, merchantReference, internalReference, normalizedStatus, mlog);
    }

    const { error: transactionUpsertError } = await supabaseAdmin.from('dusupay_transactions').upsert({
      merchant_reference: merchantReference,
      internal_reference: internalReference,
      event_type: event,
      status: normalizedStatus,
      amount,
      currency,
      raw_payload: body,
    }, { onConflict: 'merchant_reference,event_type' });

    if (transactionUpsertError) {
      mlog.error('Failed to persist processed webhook state', { err: transactionUpsertError });
      throw new Error(`Failed to persist processed webhook state: ${transactionUpsertError.message}`);
    }

    await finishWebhookClaim(merchantReference, event, claim.claimToken, 'completed');
    activeClaim = null;
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: unknown) {
    log.error('Fatal error', { err: error });
    if (activeClaim) {
      try {
        await finishWebhookClaim(activeClaim.merchantReference, activeClaim.event, activeClaim.claimToken, 'failed');
      } catch (claimError) {
        log.error('Failed to release DusuPay webhook claim for retry', { err: claimError, merchantRef: activeClaim.merchantReference });
      }
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function handleRepaymentCollection(
  merchantRef: string,
  internalRef: string,
  amount: number,
  log: Logger,
): Promise<void> {
  const parsed = parseRepaymentReference(merchantRef);
  if (!parsed.isRepayment) throw new Error(`Invalid EWA-REP reference ${merchantRef}`);

  const { data: schedule, error: scheduleError } = await supabaseAdmin
    .from('repayment_schedules')
    .select('id, advance_id, employer_id, repayment_amount, paid_amount, payment_reference, status')
    .eq('repayment_reference', merchantRef)
    .maybeSingle();

  if (scheduleError) {
    throw new Error(`Failed to load repayment schedule: ${scheduleError.message}`);
  }
  if (!schedule) {
    log.error('No repayment schedule found for EWA-REP reference', { merchantRef });
    throw new Error(`No repayment schedule found for EWA-REP reference ${merchantRef}`);
  }

  // Idempotency — never call repay_advance_to_admin for an already-paid schedule
  if (schedule.status === 'paid') {
    log.info('Repayment schedule already paid — skipping', { scheduleId: schedule.id });
    return;
  }
  if (internalRef && schedule.payment_reference === internalRef) {
    log.info('Repayment callback already applied to schedule — skipping', { scheduleId: schedule.id });
    return;
  }

  // Financial integrity: call RPC first. Only update schedule if RPC succeeds.
  const { error: rpcError } = await supabaseAdmin.rpc('repay_advance_to_admin', {
    p_advance_id: schedule.advance_id,
    p_amount:     amount,
  });

  if (rpcError) {
    log.error('repay_advance_to_admin RPC failed', { err: rpcError, scheduleId: schedule.id });
    void notifyAdmin({
      type: 'system_alert',
      title: '❌ Repayment RPC Failed',
      message: `repay_advance_to_admin failed for advance ${schedule.advance_id}. Amount: ${amount}. Reference: ${merchantRef}. Manual intervention required.`,
      metadata: {
        schedule_id: schedule.id,
        advance_id:  schedule.advance_id,
        amount,
        reference:   merchantRef,
        error:       rpcError.message,
      },
    }).catch(() => {});
    throw new Error(`repay_advance_to_admin failed: ${rpcError.message}`);
  }

  const cumulativePaid = Number(schedule.paid_amount ?? 0) + amount;
  const isPaid = cumulativePaid >= Number(schedule.repayment_amount);

  const { error: scheduleUpdateError } = await supabaseAdmin
    .from('repayment_schedules')
    .update({
      status:            isPaid ? 'paid' : 'partial',
      paid_amount:       Math.min(Number(schedule.repayment_amount), cumulativePaid),
      paid_at:           new Date().toISOString(),
      payment_reference: internalRef,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', schedule.id);

  if (scheduleUpdateError) {
    log.error('Schedule update failed after successful RPC', { err: scheduleUpdateError, scheduleId: schedule.id });
    throw new Error(`Repayment ledger succeeded but schedule update failed: ${scheduleUpdateError.message}`);
  }

  void notifyAdmin({
    type: 'system_alert',
    title: '✅ Repayment Received',
    message: `${amount} received from employer. Reference: ${merchantRef}. Advance ${schedule.advance_id} marked ${isPaid ? 'repaid' : 'partially repaid'}.`,
    metadata: { schedule_id: schedule.id, amount, reference: merchantRef, advance_id: schedule.advance_id },
  }).catch(() => {});

  // Notify employer — look up user_id from employers table
  void (async () => {
    try {
      const { data: employer } = await supabaseAdmin
        .from('employers')
        .select('user_id, company_name')
        .eq('id', schedule.employer_id)
        .maybeSingle();

      if (employer?.user_id) {
        await notifyEmployer({
          userId: employer.user_id,
          type: 'system',
          title: isPaid ? 'Repayment Confirmed' : 'Partial Repayment Received',
          message: `Your repayment of ${amount} has been received and confirmed. Reference: ${merchantRef}`,
          metadata: { schedule_id: schedule.id, amount, reference: merchantRef, companyName: employer.company_name },
        });
      }
    } catch (notifyErr) {
      log.error('Employer repayment notification failed (non-fatal)', { err: notifyErr });
    }
  })();

  log.info('Repayment reconciliation complete', { scheduleId: schedule.id, isPaid, amount });
}

// A payday recoupment is a lump-sum collection covering everything that was
// pending/overdue for an employer at the moment the prompt was generated — not
// a single advance like EWA-REP-. Applies the collected amount across each
// currently pending/overdue schedule via the same repay_advance_to_admin RPC
// used by manual admin repayment, in order, until it runs out.
async function handlePaydayRecoupmentCollection(
  status: 'COMPLETED' | 'FAILED' | 'PENDING',
  merchantRef: string,
  internalRef: string,
  amount: number,
  log: Logger,
): Promise<void> {
  const { data: recoupment, error: recoupmentError } = await supabaseAdmin
    .from('payday_recoupments')
    .select('id, employer_id, amount_due, status, failure_reason')
    .eq('merchant_reference', merchantRef)
    .maybeSingle();

  if (recoupmentError) throw new Error(`Failed to load payday recoupment: ${recoupmentError.message}`);
  if (!recoupment) {
    log.error('No payday_recoupments row found for EWA-PAYDAY reference', { merchantRef });
    throw new Error(`No payday recoupment found for ${merchantRef}`);
  }

  // Idempotency — never re-apply an already-collected recoupment.
  if (recoupment.status === 'collected') {
    log.info('Payday recoupment already collected — skipping', { recoupmentId: recoupment.id });
    return;
  }
  if (
    recoupment.status === 'failed'
    && (recoupment.failure_reason?.startsWith('Webhook processing failed:')
      || recoupment.failure_reason === 'RPC execution error during collection application')
  ) {
    log.error('Payday recoupment requires manual ledger reconciliation; refusing automatic replay', {
      recoupmentId: recoupment.id,
      merchantRef,
    });
    return;
  }

  if (status === 'FAILED') {
    const { error } = await supabaseAdmin.from('payday_recoupments').update({
      status: 'failed',
      failure_reason: 'DusuPay collection failed or was declined by the mobile money subscriber',
      updated_at: new Date().toISOString(),
    }).eq('id', recoupment.id);
    if (error) throw new Error(`Failed to persist failed payday recoupment: ${error.message}`);

    void notifyAdmin({
      type: 'system_alert',
      title: '❌ Payday Recoupment Failed',
      message: `Payday recoupment collection failed for employer ${recoupment.employer_id}. Reference: ${merchantRef}.`,
      metadata: { recoupment_id: recoupment.id, employer_id: recoupment.employer_id, reference: merchantRef },
    }).catch(() => {});
    return;
  }

  if (status !== 'COMPLETED') {
    log.info('Payday recoupment pending event — skipping');
    return;
  }

  await applyPaydayRecoupmentCollection(recoupment.id, recoupment.employer_id, amount, internalRef, log);
}

async function handleCollectionEvent(
  event: string,
  payload: DusupayWebhookPayload,
  merchantRef: string,
  internalRef: string,
  normalizedStatus: 'COMPLETED' | 'FAILED' | 'PENDING',
  log: Logger,
) {
  // Repayment collections (employer paying back an advance) are distinct from
  // wallet top-ups (DEP-). Route them before the DEP- guard.
  if (merchantRef.startsWith('EWA-REP-')) {
    if (normalizedStatus !== 'COMPLETED') {
      log.info('EWA-REP non-completion event — skipping', { event, status: normalizedStatus });
      return;
    }
    const repaymentAmount = Number(payload.transaction_amount);
    if (!Number.isFinite(repaymentAmount) || repaymentAmount <= 0) {
      log.error('EWA-REP webhook missing or zero transaction_amount — skipping repayment RPC', { merchantRef, payload });
      void notifyAdmin({
        type: 'system_alert',
        title: '❌ Repayment Webhook Malformed',
        message: `Repayment webhook for ${merchantRef} had no valid amount (got: ${repaymentAmount}). Manual review required.`,
        metadata: { merchantRef, payload },
      }).catch(() => {});
      throw new Error(`Invalid amount for EWA-REP callback ${merchantRef}`);
    }
    await handleRepaymentCollection(merchantRef, internalRef, repaymentAmount, log);
    return; // never fall through to DEP- logic
  }

  if (merchantRef.startsWith('EWAPAYDAY')) {
    const collectedAmount = Number(payload.transaction_amount);
    if (normalizedStatus === 'COMPLETED' && (!Number.isFinite(collectedAmount) || collectedAmount <= 0)) {
      log.error('EWA-PAYDAY webhook missing or zero transaction_amount — skipping', { merchantRef, payload });
      void notifyAdmin({
        type: 'system_alert',
        title: '❌ Payday Recoupment Webhook Malformed',
        message: `Payday recoupment webhook for ${merchantRef} had no valid amount (got: ${collectedAmount}). Manual review required.`,
        metadata: { merchantRef, payload },
      }).catch(() => {});
      throw new Error(`Invalid amount for payday recoupment callback ${merchantRef}`);
    }
    await handlePaydayRecoupmentCollection(normalizedStatus, merchantRef, internalRef, collectedAmount, log);
    return; // never fall through to DEP- logic
  }

  if (!merchantRef.startsWith('DEP-')) return;

  // Terminal status guard: skip if wallet_transactions already has a completed row for this reference.
  const { data: existingWalletTx, error: existingWalletTxError } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id, status')
    .eq('reference', merchantRef)
    .maybeSingle();

  if (existingWalletTxError) throw new Error(`Failed to load wallet transaction: ${existingWalletTxError.message}`);
  if (existingWalletTx?.status === 'completed') {
    log.info('Wallet transaction already completed — skipping');
    return;
  }

  // employerId is itself a UUID (contains hyphens), so a naive split('-')
  // would only capture its first segment — anchor on the numeric timestamp
  // suffix instead to correctly extract the full UUID in between.
  const depMatch = merchantRef.match(/^DEP-(.+)-(\d+)$/);
  const employerId = depMatch?.[1];
  const amount = Number(payload.transaction_amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    log.error('DEP- webhook missing valid transaction_amount', { merchantRef, payload });
    throw new Error(`Invalid DEP- callback amount for ${merchantRef}`);
  }

  if (!employerId) {
    log.error('DEP- webhook reference did not match expected format', { merchantRef });
    throw new Error(`Malformed DEP- callback reference ${merchantRef}`);
  }

  const { data: wallet, error: walletError } = await supabaseAdmin
    .from('employer_wallets')
    .select('id')
    .eq('employer_id', employerId)
    .maybeSingle();

  if (walletError) throw new Error(`Failed to load employer wallet: ${walletError.message}`);
  let walletId = wallet?.id;
  if (!wallet) {
    const { data: newWallet, error: createWalletError } = await supabaseAdmin
      .from('employer_wallets')
      .insert({ employer_id: employerId, total_advanced: 0, outstanding_liability: 0, total_repaid: 0, currency: 'KES', updated_at: new Date().toISOString() })
      .select('id')
      .single();
    if (createWalletError || !newWallet) {
      throw new Error(`Failed to create employer wallet: ${createWalletError?.message ?? 'no row returned'}`);
    }
    walletId = newWallet.id;
  }

  const transactionStatus = normalizedStatus === 'COMPLETED'
    ? 'pending'
    : normalizedStatus === 'FAILED' ? 'failed' : 'pending';
  const { data: walletTx, error: walletTxError } = await supabaseAdmin
    .from('wallet_transactions')
    .upsert({
      ...(existingWalletTx?.id ? { id: existingWalletTx.id } : {}),
      wallet_id: walletId,
      amount,
      type: 'deposit',
      status: transactionStatus,
      reference: merchantRef,
      internal_reference: internalRef,
      description: 'Wallet Funding via Dusupay',
      metadata: payload,
    }, { onConflict: 'reference' })
    .select('id')
    .single();
  if (walletTxError || !walletTx) {
    throw new Error(`Failed to persist wallet transaction: ${walletTxError?.message ?? 'no row returned'}`);
  }

  // Credit the employer's actual available balance BEFORE the upsert below —
  // credit_employer_wallet_prefunded() itself flips this row to 'completed'
  // (and is safe to call even if the upsert hasn't run yet, since it looks
  // the row up by id, not by relying on the upsert having happened first).
  // Only total_advanced increases here — this is the employer's own money
  // collected via DusuPay, not an admin-fronted loan, so outstanding_liability
  // and admin_wallets are correctly left untouched (see the RPC definition).
  if (normalizedStatus === 'COMPLETED') {
    const { error: creditError } = await supabaseAdmin.rpc('credit_employer_wallet_prefunded', {
      p_employer_id: employerId,
      p_amount: amount,
      p_wallet_transaction_id: walletTx.id,
    });
    if (creditError) {
      log.error('credit_employer_wallet_prefunded RPC failed', { err: creditError, employerId, amount });
      void notifyAdmin({
        type: 'system_alert',
        title: 'Employer Wallet Credit Failed',
        message: `DusuPay confirmed a wallet top-up collection for employer ${employerId} but crediting the wallet failed. Manual intervention required. Reference: ${merchantRef}.`,
        metadata: { employerId, amount, merchantRef, error: creditError.message },
      }).catch(() => {});
      throw new Error(`Employer wallet credit failed: ${creditError.message}`);
    }
  }

  try {
    const { data: employer } = await supabaseAdmin
      .from('employer_onboarding')
      .select('user_id')
      .eq('id', employerId)
      .single();

    if (employer?.user_id) {
      await notifyEmployer({
        userId: employer.user_id,
        type: 'system',
        title: normalizedStatus === 'COMPLETED' ? 'Wallet Funded' : normalizedStatus === 'FAILED' ? 'Funding Failed' : 'Funding Pending',
        message: normalizedStatus === 'COMPLETED'
          ? `Your wallet has been successfully funded with ${amount}. You can now disburse advances.`
          : normalizedStatus === 'FAILED'
            ? `We couldn't process your wallet funding of ${amount}. Please check your payment details.`
            : `Your wallet funding of ${amount} is still being processed.`,
        metadata: { amount, status: normalizedStatus.toLowerCase(), reference: merchantRef }
      });
    }
  } catch (notifyErr) {
    log.error('Employer notification failed', { err: notifyErr, employerId });
  }

  log.info('Wallet funding processed', { employerId, amount, status: normalizedStatus });
}

// Employer wallet funding payout (debit_order/invoice employers) — EaziWage
// pays the employer real cash via DusuPay. The ledger update
// (fund_employer_from_admin, real admin-fronted liability) is deliberately
// deferred to here rather than run synchronously in the approve route, so
// employer_wallets/admin_wallets only change once DusuPay actually confirms
// the money moved.
async function handleEmployerFundingPayout(
  event: string,
  payload: DusupayWebhookPayload,
  merchantRef: string,
  internalRef: string,
  normalizedStatus: 'COMPLETED' | 'FAILED' | 'PENDING',
  log: Logger,
) {
  const match = merchantRef.match(/^EWA-FUND-(.+)-(\d+)$/);
  const employerId = match?.[1];
  if (!employerId) {
    log.error('EWA-FUND- webhook reference did not match expected format', { merchantRef });
    throw new Error(`Malformed EWA-FUND reference ${merchantRef}`);
  }

  const { data: tx, error: txError } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id, status, amount, usd_amount, local_currency, description, metadata')
    .eq('reference', merchantRef)
    .maybeSingle();

  if (txError) throw new Error(`Failed to load employer funding transaction: ${txError.message}`);
  if (!tx) {
    log.error('No wallet_transactions row found for EWA-FUND- reference', { merchantRef });
    throw new Error(`No wallet transaction found for ${merchantRef}`);
  }

  if (['completed', 'failed'].includes(tx.status)) {
    log.info('Wallet transaction already in terminal status — skipping', { txId: tx.id, status: tx.status });
    return;
  }

  const isCompleted = normalizedStatus === 'COMPLETED';
  const isFailed = normalizedStatus === 'FAILED';

  if (!isCompleted && !isFailed) {
    log.info('Non-terminal event for employer funding payout — skipping', { event, merchantRef, status: normalizedStatus });
    return;
  }

  if (isFailed) {
    const { error: updateError } = await supabaseAdmin.from('wallet_transactions').update({
      status: 'failed',
      metadata: Object.assign({}, tx.metadata ?? {}, { failure_reason: 'DusuPay reported the payout as failed', webhook_event: event }),
    }).eq('id', tx.id);
    if (updateError) throw new Error(`Failed to record failed employer funding payout: ${updateError.message}`);

    void notifyAdmin({
      type: 'system_alert',
      title: 'Employer Funding Payout Failed',
      message: `DusuPay reported the wallet funding payout for employer ${employerId} (reference ${merchantRef}) as failed.`,
      metadata: { employerId, merchantRef, amount: tx.amount },
    }).catch(() => {});

    log.info('Employer funding payout marked failed', { employerId, merchantRef });
    return;
  }

  const { data: adminWallet, error: adminWalletError } = await supabaseAdmin
    .from('admin_wallets')
    .select('id')
    .eq('name', 'Main Stanbic Source')
    .maybeSingle();

  if (adminWalletError) throw new Error(`Failed to load admin wallet: ${adminWalletError.message}`);
  if (!adminWallet) {
    log.error('Admin wallet not found — cannot fund employer', { merchantRef, employerId });
    void notifyAdmin({
      type: 'system_alert',
      title: 'Employer Funding Payout — Admin Wallet Missing',
      message: `DusuPay confirmed a wallet funding payout for employer ${employerId} (reference ${merchantRef}) but the admin wallet could not be found. Manual intervention required.`,
      metadata: { employerId, merchantRef, amount: tx.amount },
    }).catch(() => {});
    throw new Error(`Admin wallet not found for confirmed funding payout ${merchantRef}`);
  }

  // Defensive: the approve route already refuses to initiate a payout with a
  // null usd_amount, but never fall back to treating the local-currency
  // amount as USD here either — that would deduct the wrong figure from the
  // admin wallet for money that has already actually been sent.
  if (tx.usd_amount === null) {
    log.error('EWA-FUND- webhook has no usd_amount — refusing to credit ledger with an unsafe fallback', { merchantRef, employerId });
    void notifyAdmin({
      type: 'system_alert',
      title: 'Employer Funding Ledger Update Blocked — Missing USD Amount',
      message: `DusuPay confirmed a wallet funding payout for employer ${employerId} (reference ${merchantRef}) but the wallet_transactions row has no usd_amount. Real money has moved but the ledger was NOT updated — resolve manually.`,
      metadata: { employerId, merchantRef, amount: tx.amount },
    }).catch(() => {});
    throw new Error(`USD amount missing for confirmed funding payout ${merchantRef}`);
  }

  const approvedBy = (tx.metadata as Record<string, unknown> | null)?.approved_by;

  const { error: rpcError } = await supabaseAdmin.rpc('fund_employer_from_admin', {
    p_employer_id: employerId,
    p_admin_wallet_id: adminWallet.id,
    p_amount_usd: tx.usd_amount,
    p_amount_local: tx.amount,
    p_description: tx.description || `Wallet funding payout confirmed ${merchantRef}`,
    p_admin_id: typeof approvedBy === 'string' ? approvedBy : null,
    p_currency: tx.local_currency || 'KES',
    p_existing_wallet_transaction_id: tx.id,
  });

  if (rpcError) {
    log.error('fund_employer_from_admin RPC failed for confirmed payout', { err: rpcError, employerId, merchantRef });
    void notifyAdmin({
      type: 'system_alert',
      title: 'Employer Funding Ledger Update Failed',
      message: `DusuPay confirmed a wallet funding payout for employer ${employerId} (reference ${merchantRef}) but crediting the ledger failed. Manual intervention required — real money has moved.`,
      metadata: { employerId, merchantRef, amount: tx.amount, error: rpcError.message },
    }).catch(() => {});
    throw new Error(`fund_employer_from_admin failed: ${rpcError.message}`);
  }

  try {
    const { data: employer } = await supabaseAdmin
      .from('employers')
      .select('user_id, company_name, currency')
      .eq('id', employerId)
      .maybeSingle();

    if (employer?.user_id) {
      await notifyEmployer({
        userId: employer.user_id,
        type: 'wallet_topup_approved',
        title: 'Wallet Funding Confirmed',
        message: `Your wallet funding of ${employer.currency ?? tx.local_currency ?? 'KES'} ${Number(tx.amount).toLocaleString()} has been confirmed and credited.`,
        metadata: { amount: tx.amount, reference: merchantRef, companyName: employer.company_name },
      });
    }
  } catch (notifyErr) {
    log.error('Employer notification failed', { err: notifyErr, employerId });
  }

  log.info('Employer funding payout confirmed and credited', { employerId, merchantRef, amount: tx.amount });
}

interface AdvancePayoutRow {
  id: string;
  status: string;
  employer_id: string;
  amount: number;
  employee_id: string;
  employees?: { user_id?: string | null } | Array<{ user_id?: string | null }> | null;
}

function getOnboardingUserId(
  onboarding: AdvancePayoutRow['employees']
): string | undefined {
  if (!onboarding) return undefined;
  if (Array.isArray(onboarding)) return onboarding[0]?.user_id ?? undefined;
  return onboarding.user_id ?? undefined;
}

async function handlePayoutEvent(
  event: string,
  payload: DusupayWebhookPayload,
  merchantRef: string,
  internalRef: string,
  normalizedStatus: 'COMPLETED' | 'FAILED' | 'PENDING',
  log: Logger,
) {
  const isCompleted = normalizedStatus === 'COMPLETED';
  const isFailed = normalizedStatus === 'FAILED';
  const newStatus = isCompleted ? 'disbursed_pending_ledger' : isFailed ? 'failed' : 'processing';

  const { data: advanceData, error: advanceError } = await supabaseAdmin
    .from('advances')
    .select('id, status, employer_id, amount, employee_id, employees!advances_employee_id_fkey(user_id)')
    .eq('reference', merchantRef)
    .single();

  if (advanceError) {
    log.error('Failed to fetch advance', { err: advanceError });
    throw new Error(`Failed to fetch advance for DusuPay webhook: ${advanceError.message}`);
  }

  const advance = advanceData as AdvancePayoutRow | null;

  if (!advance) {
    log.error('No advance found for reference');
    throw new Error(`No advance found for DusuPay reference ${merchantRef}`);
  }

  if (['completed', 'failed', 'repaid'].includes(advance.status)) {
    log.info('Advance already in terminal status — skipping', { advanceId: advance.id, currentStatus: advance.status });
    return;
  }
  if (advance.status === 'disbursed_pending_ledger' && !isCompleted) {
    log.info('Ignoring non-completion callback after DusuPay completion', { advanceId: advance.id, event, normalizedStatus });
    return;
  }

  const { error: updateError } = await supabaseAdmin.from('advances').update({
    status: newStatus,
    internal_reference: internalRef,
    ...(isCompleted && { disbursed_at: new Date().toISOString() })
  }).eq('id', advance.id);

  if (updateError) {
    log.error('Failed to update advance status', { err: updateError, advanceId: advance.id });
    throw new Error(`Failed to update advance ${advance.id} from DusuPay webhook: ${updateError.message}`);
  }

  log.info('Advance status updated', { advanceId: advance.id, newStatus });

  // Audit trail — CBK compliance requires a record of every status transition
  void supabaseAdmin.from('system_audit_logs').insert({
    admin_id: advance.employer_id,
    admin_name: 'system:dusupay-webhook',
    target_id: advance.id,
    target_type: 'advance',
    action: `advance_${newStatus}`,
    old_value: { status: advance.status },
    new_value: { status: newStatus, internal_reference: internalRef },
    metadata: { event, merchant_reference: merchantRef },
  }).then(({ error }) => {
    if (error) log.error('Audit log insert failed', { err: error, advanceId: advance.id });
  });

  try {
    const employeeUserId = getOnboardingUserId(advance.employees);

    if (employeeUserId) {
      await notifyEmployee({
        userId: employeeUserId,
        type: 'advance_approval',
        title: isCompleted ? 'Funds Received!' : 'Disbursement Failed',
        message: isCompleted
          ? `Your advance of ${advance.amount} has been successfully sent to your mobile wallet/account.`
          : `There was an issue sending your advance of ${advance.amount}. Please contact support.`,
        metadata: { advance_id: advance.id, status: newStatus }
      });
    } else {
      log.warn('No employee user_id resolved — notification skipped', { advanceId: advance.id });
    }
  } catch (notifyErr) {
    log.error('Employee notification failed', { err: notifyErr, advanceId: advance.id });
  }

  if (isCompleted && advance.employer_id) {
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('employer_wallets')
      .select('id')
      .eq('employer_id', advance.employer_id)
      .single();

    if (walletError || !wallet) {
      throw new Error(`Employer wallet not found after confirmed payout: ${walletError?.message ?? advance.employer_id}`);
    }
    const { error: payoutLedgerError } = await supabaseAdmin.from('wallet_transactions').upsert({
        wallet_id: wallet.id,
        amount: -Number(advance.amount),
        type: 'payout',
        status: 'completed',
        reference: `PAY-${merchantRef}`,
        internal_reference: internalRef,
        description: `Disbursement for Advance #${advance.id}`,
        metadata: { advance_id: advance.id }
      }, { onConflict: 'reference' });
    if (payoutLedgerError) {
      throw new Error(`Failed to persist confirmed payout ledger entry: ${payoutLedgerError.message}`);
    }
  }
}
