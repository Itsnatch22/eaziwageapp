import { NextRequest, NextResponse } from 'next/server';
import { dusupay } from '@/lib/dusupay';
import { PayoutStatus } from '@/lib/dusupay/types';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyEmployee, notifyEmployer, notifyAdmin } from '@/lib/notifications';
import { parseRepaymentReference } from '@/lib/repayment/utils';
import { requestLogger, type Logger } from '@/lib/logger';

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

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-real-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()) ?? 'unknown';
  const log = requestLogger('webhook-dusupay', req).child({ ip });

  log.info('Webhook received');

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
    const transactionStatus = payload.transaction_status || payload.status;
    const amount = Number(payload.transaction_amount);
    const currency = payload.transaction_currency;

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

    // Idempotency: check stored state BEFORE upserting so we read the pre-existing status.
    const { data: existingTx } = await supabaseAdmin
      .from('dusupay_transactions')
      .select('status')
      .eq('merchant_reference', merchantReference)
      .eq('event_type', event)
      .maybeSingle();

    if (existingTx?.status === 'COMPLETED') {
      mlog.info('Already processed — skipping');
      return NextResponse.json({ received: true }, { status: 200 });
    }

    await supabaseAdmin.from('dusupay_transactions').upsert({
      merchant_reference: merchantReference,
      internal_reference: internalReference,
      event_type: event,
      status: transactionStatus,
      amount: amount,
      currency: currency,
      raw_payload: body,
    }, { onConflict: 'merchant_reference,event_type' });

    if (event.startsWith('collection.')) {
      await handleCollectionEvent(event, payload, merchantReference, internalReference, mlog);
    } else {
      await handlePayoutEvent(event, payload, merchantReference, internalReference, mlog);
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: unknown) {
    log.error('Fatal error', { err: error });
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
  if (!parsed.isRepayment) return;

  const { data: schedule } = await supabaseAdmin
    .from('repayment_schedules')
    .select('id, advance_id, employer_id, repayment_amount, status')
    .eq('repayment_reference', merchantRef)
    .maybeSingle();

  if (!schedule) {
    log.error('No repayment schedule found for EWA-REP reference', { merchantRef });
    return;
  }

  // Idempotency — never call repay_advance_to_admin for an already-paid schedule
  if (schedule.status === 'paid') {
    log.info('Repayment schedule already paid — skipping', { scheduleId: schedule.id });
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
    // Do NOT update schedule — leave it pending so the next webhook retry can reprocess
    return;
  }

  const isPaid = amount >= Number(schedule.repayment_amount);

  const { error: scheduleUpdateError } = await supabaseAdmin
    .from('repayment_schedules')
    .update({
      status:            isPaid ? 'paid' : 'partial',
      paid_amount:       amount,
      paid_at:           new Date().toISOString(),
      payment_reference: internalRef,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', schedule.id);

  if (scheduleUpdateError) {
    // RPC already ran — financial state is correct. Log for reconciliation.
    log.error('Schedule update failed after successful RPC', { err: scheduleUpdateError, scheduleId: schedule.id });
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

async function handleCollectionEvent(
  event: string,
  payload: DusupayWebhookPayload,
  merchantRef: string,
  internalRef: string,
  log: Logger,
) {
  // Repayment collections (employer paying back an advance) are distinct from
  // wallet top-ups (DEP-). Route them before the DEP- guard.
  if (merchantRef.startsWith('EWA-REP-')) {
    if (event !== 'collection.completed') {
      log.info('EWA-REP non-completion event — skipping', { event });
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
      return;
    }
    await handleRepaymentCollection(merchantRef, internalRef, repaymentAmount, log);
    return; // never fall through to DEP- logic
  }

  if (!merchantRef.startsWith('DEP-')) return;

  // Terminal status guard: skip if wallet_transactions already has a completed row for this reference.
  const { data: existingWalletTx } = await supabaseAdmin
    .from('wallet_transactions')
    .select('status')
    .eq('reference', merchantRef)
    .maybeSingle();

  if (existingWalletTx?.status === 'completed') {
    log.info('Wallet transaction already completed — skipping');
    return;
  }

  const parts = merchantRef.split('-');
  const employerId = parts[1];
  const amount = Number(payload.transaction_amount);

  if (!Number.isFinite(amount)) {
    log.error('DEP- webhook missing valid transaction_amount', { merchantRef, payload });
    return;
  }

  if (!employerId) return;

  const { data: wallet } = await supabaseAdmin
    .from('employer_wallets')
    .select('id')
    .eq('employer_id', employerId)
    .maybeSingle();

  if (!wallet) {
    const { data: newWallet } = await supabaseAdmin
      .from('employer_wallets')
      .insert({ employer_id: employerId, total_advanced: 0, outstanding_liability: 0, total_repaid: 0, currency: 'KES', updated_at: new Date().toISOString() })
      .select('id')
      .single();
    if (!newWallet) return;
  }

  const walletId = wallet?.id || (await supabaseAdmin.from('employer_wallets').select('id').eq('employer_id', employerId).single()).data?.id;

  const status = (event === 'collection.completed' || payload.status === 'COMPLETED') ? 'completed' : 'failed';

  await supabaseAdmin
    .from('wallet_transactions')
    .upsert({
      wallet_id: walletId,
      amount: amount,
      type: 'deposit',
      status: status,
      reference: merchantRef,
      internal_reference: internalRef,
      description: 'Wallet Funding via Dusupay',
      metadata: payload
    }, { onConflict: 'reference' });

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
        title: status === 'completed' ? 'Wallet Funded' : 'Funding Failed',
        message: status === 'completed'
          ? `Your wallet has been successfully funded with ${amount}. You can now disburse advances.`
          : `We couldn't process your wallet funding of ${amount}. Please check your payment details.`,
        metadata: { amount, status, reference: merchantRef }
      });
    }
  } catch (notifyErr) {
    log.error('Employer notification failed', { err: notifyErr, employerId });
  }

  log.info('Wallet funding processed', { employerId, amount, status });
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
  log: Logger,
) {
  const isCompleted = event === 'transaction.completed' || (payload.status as string) === PayoutStatus.COMPLETED;
  const isFailed = ['transaction.failed', 'request.failed'].includes(event) ||
                   [PayoutStatus.FAILED, PayoutStatus.CANCELLED].map(s => s as string).includes(payload.status || '');
  const newStatus = isCompleted ? 'completed' : isFailed ? 'failed' : 'processing';

  const { data: advanceData, error: advanceError } = await supabaseAdmin
    .from('advances')
    .select('id, status, employer_id, amount, employee_id, employees!advances_employee_id_fkey(user_id)')
    .eq('reference', merchantRef)
    .single();

  if (advanceError) {
    log.error('Failed to fetch advance', { err: advanceError });
  }

  const advance = advanceData as AdvancePayoutRow | null;

  if (!advance) {
    log.error('No advance found for reference');
    return;
  }

  if (['completed', 'failed', 'repaid'].includes(advance.status)) {
    log.info('Advance already in terminal status — skipping', { advanceId: advance.id, currentStatus: advance.status });
    return;
  }

  await supabaseAdmin.from('advances').update({
    status: newStatus,
    internal_reference: internalRef,
    ...(isCompleted && { disbursed_at: new Date().toISOString() })
  }).eq('id', advance.id);

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
    const { data: wallet } = await supabaseAdmin
      .from('employer_wallets')
      .select('id')
      .eq('employer_id', advance.employer_id)
      .single();

    if (wallet) {
      await supabaseAdmin.from('wallet_transactions').upsert({
        wallet_id: wallet.id,
        amount: -Number(advance.amount),
        type: 'payout',
        status: 'completed',
        reference: `PAY-${merchantRef}`,
        internal_reference: internalRef,
        description: `Disbursement for Advance #${advance.id}`,
        metadata: { advance_id: advance.id }
      }, { onConflict: 'reference' });
    }
  }
}
