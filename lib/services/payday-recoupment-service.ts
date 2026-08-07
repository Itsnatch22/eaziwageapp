import { supabaseAdmin } from '../supabaseAdmin';
import { notifyAdmin, notifyEmployer } from '../notifications';
import { resolveEffectivePaydayDayOfMonth } from '../repayment/utils';
import type { Logger } from '../logger';

// Mirrors payout-service.ts's clampDayToMonth so "is today payday" and "when is
// the due date" agree on the same effective date.
function clampDayToMonth(year: number, monthIndex: number, day: number): number {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(day, lastDay);
}

interface PaydayRecoupmentRow {
  id: string;
  employer_id: string;
  payday_date: string;
  amount_due: number;
  currency: string;
  status: string;
}

/**
 * Checks whether today is the given employer's (effective) payday and, if so,
 * creates a payday_recoupments row for the full outstanding_liability balance —
 * not a repayment_schedules sum, which only covers disbursed-and-scheduled
 * advances and can under-count real liability recorded at funding time (see
 * applyPaydayRecoupmentCollection above). Returns the existing unresolved row
 * (from today or a past cycle) if one is already pending, so this is safe to
 * call repeatedly (per-employer page load, or a daily cron pass over every
 * employer) without creating duplicates.
 *
 * BANK-PRIMARY RECOUPMENT MODEL (V2)
 * ==================================
 * The recoupment_method field on employers now controls the preferred channel:
 * - 'bank' (default): Bank account is the primary collection method; mobile money
 *   is fallback if bank transfer fails or is manually declined.
 * - 'mobile_money': Mobile money is preferred (legacy); bank is fallback.
 *
 * FUTURE: Automated Bank Collection
 * When Stanbic direct debit/standing order support is confirmed:
 * 1. After inserting payday_recoupments, if preferredMethod === 'bank':
 *    a. Call Stanbic API to initiate direct debit/standing order (if configured).
 *    b. Update payday_recoupments.status to 'collecting' (not 'pending_response').
 *    c. Hook the Stanbic callback webhook into the collection flow.
 * 2. Update notification copy to indicate bank collection is in progress.
 * 3. If the bank collection fails (or is declined), fall back to mobile money
 *    via the existing DusuPay workflow.
 *
 * For now, bank collection remains a manual-confirm flow (same UI as today),
 * with bank as the default expectation instead of mobile money.
 */
export async function checkAndCreatePaydayRecoupment(
  employerId: string,
  employerUserId: string | null,
  employerCompanyName: string | null,
  fallbackPaydayDayOfMonth: number | null,
  recoupmentMethod?: string | null,
  preResolvedPaydayDay?: number | null,
): Promise<PaydayRecoupmentRow | null> {
  const paydayDayOfMonth = preResolvedPaydayDay ?? await resolveEffectivePaydayDayOfMonth(
    employerId,
    fallbackPaydayDayOfMonth,
    supabaseAdmin,
  );

  if (!paydayDayOfMonth) return null;

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  const effectivePaydayDay = clampDayToMonth(year, month, paydayDayOfMonth);
  const isPaydayToday = day === effectivePaydayDay;
  const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // Any not-yet-resolved row (from today or a past cycle) keeps surfacing until
  // acted on — an employer shouldn't be able to make a prompt disappear by just
  // waiting for the day to pass.
  const { data: existing } = await supabaseAdmin
    .from('payday_recoupments')
    .select('*')
    .eq('employer_id', employerId)
    .in('status', ['pending_response', 'confirmed', 'collecting', 'partially_collected', 'failed'])
    .order('payday_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as PaydayRecoupmentRow;
  if (!isPaydayToday) return null;

  const { data: wallet } = await supabaseAdmin
    .from('employer_wallets')
    .select('outstanding_liability, currency')
    .eq('employer_id', employerId)
    .maybeSingle();

  const amountDue = Number(wallet?.outstanding_liability ?? 0);
  if (amountDue <= 0) return null;

  const currency = wallet?.currency || 'KES';

  // Determine preferred recoupment method: 'bank' (primary) or 'mobile_money' (fallback)
  const preferredMethod = recoupmentMethod === 'mobile_money' ? 'mobile_money' : 'bank';

  const { data: created, error: createError } = await supabaseAdmin
    .from('payday_recoupments')
    .insert({
      employer_id: employerId,
      payday_date: todayStr,
      amount_due: amountDue,
      currency,
      status: 'pending_response',
      recoupment_method: preferredMethod,
    })
    .select('*')
    .single();

  if (createError) {
    // The (employer_id, payday_date) unique constraint racing with a concurrent
    // request/cron pass is the only expected failure here — re-fetch instead of erroring.
    const { data: raced } = await supabaseAdmin
      .from('payday_recoupments')
      .select('*')
      .eq('employer_id', employerId)
      .eq('payday_date', todayStr)
      .maybeSingle();
    return (raced as PaydayRecoupmentRow) ?? null;
  }

  // Mirrors the current recoupment cycle onto employer_wallets so admin
  // employer-list views can see "is this employer overdue" without joining
  // payday_recoupments. Cleared in applyPaydayRecoupmentCollection once collected.
  await supabaseAdmin
    .from('employer_wallets')
    .update({ repayment_due_date: todayStr })
    .eq('employer_id', employerId);

  if (employerUserId) {
    void notifyEmployer({
      userId: employerUserId,
      type: 'system',
      title: 'Payday Recoupment Due',
      message: `Today is your payday — ${currency} ${amountDue.toLocaleString()} is due for recoupment. Visit Wallet & Funding to confirm.`,
      metadata: { recoupment_id: created.id, employer_id: employerId, amount_due: amountDue, recoupment_method: preferredMethod },
    }).catch(() => {});
  }

  void notifyAdmin({
    type: 'system_alert',
    title: `📅 Payday Recoupment Due — ${employerCompanyName ?? employerId}`,
    message: `${currency} ${amountDue.toLocaleString()} is due for recoupment today (via ${preferredMethod}).`,
    metadata: { recoupment_id: created.id, employer_id: employerId, amount_due: amountDue, recoupment_method: preferredMethod },
  }).catch(() => {});

  return created as PaydayRecoupmentRow;
}

// Shared by the DusuPay webhook (automated mobile money collection) and the admin
// manual-collect route (bank-transfer fallback when mobile money fails) — both
// need to apply a collected amount against an employer's liability the same way
// and mark the recoupment collected.
//
// amount_due (and therefore `amount` here) is sourced from
// employer_wallets.outstanding_liability, not the repayment_schedules sum —
// outstanding_liability is recorded in full at funding time (fund_employer_from_admin),
// so it can exceed what repayment_schedules covers (schedules only exist for
// advances that have actually been disbursed). Settle real per-advance schedules
// first (keeps advance-level repayment history/audit trail accurate), then apply
// any remainder directly against the liability balance via
// repay_employer_liability_to_admin — that remainder represents funded float with
// no advance backing it yet, which is still owed under the loan model.
export async function applyPaydayRecoupmentCollection(
  recoupmentId: string,
  employerId: string,
  amount: number,
  paymentReference: string,
  log: Logger,
): Promise<void> {
  // Atomic claim to prevent double-collection concurrency race conditions
  const { data: claimed } = await supabaseAdmin
    .from('payday_recoupments')
    .update({ status: 'processing_collection', updated_at: new Date().toISOString() })
    .eq('id', recoupmentId)
    .in('status', ['pending_response', 'confirmed', 'failed', 'partially_collected', 'collecting'])
    .select('id, amount_due, status')
    .maybeSingle();

  if (!claimed) {
    log.info('Payday recoupment already collected or processing — skipping', { recoupmentId });
    return;
  }

  const originalAmountDue = Number(claimed.amount_due ?? 0);

  const { data: schedules } = await supabaseAdmin
    .from('repayment_schedules')
    .select('id, advance_id, repayment_amount, paid_amount')
    .eq('employer_id', employerId)
    .in('status', ['pending', 'overdue', 'partial']);

  let remaining = amount;
  let hasRpcError = false;

  for (const schedule of schedules ?? []) {
    if (remaining <= 0) break;
    const alreadyPaid = Number(schedule.paid_amount ?? 0);
    const scheduleAmount = Number(schedule.repayment_amount);
    const unpaidBalance = scheduleAmount - alreadyPaid;
    if (unpaidBalance <= 0) continue;

    const applied = Math.min(remaining, unpaidBalance);

    const { error: rpcError } = await supabaseAdmin.rpc('repay_advance_to_admin', {
      p_advance_id: schedule.advance_id,
      p_amount: applied,
    });

    if (rpcError) {
      log.error('repay_advance_to_admin RPC failed during payday recoupment', { err: rpcError, scheduleId: schedule.id });
      hasRpcError = true;
      continue;
    }

    const newTotalPaid = alreadyPaid + applied;
    const isFullyPaid = newTotalPaid >= scheduleAmount;

    await supabaseAdmin.from('repayment_schedules').update({
      status: isFullyPaid ? 'paid' : 'partial',
      paid_amount: newTotalPaid,
      paid_at: new Date().toISOString(),
      payment_reference: paymentReference,
      updated_at: new Date().toISOString(),
    }).eq('id', schedule.id);

    remaining -= applied;
  }

  if (remaining > 0) {
    const { error: liabilityErr } = await supabaseAdmin.rpc('repay_employer_liability_to_admin', {
      p_employer_id: employerId,
      p_amount: remaining,
      p_reference: paymentReference,
    });

    if (liabilityErr) {
      log.error('repay_employer_liability_to_admin RPC failed during payday recoupment', { err: liabilityErr, employerId, remaining });
      hasRpcError = true;
    }
  }

  const remainingDue = Math.max(0, originalAmountDue - amount);
  const isFullyCollected = remainingDue <= 0 && !hasRpcError;

  if (isFullyCollected) {
    await supabaseAdmin.from('payday_recoupments').update({
      status: 'collected',
      amount_due: 0,
      collected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', recoupmentId);

    // Cycle resolved — clear the overdue signal set by checkAndCreatePaydayRecoupment.
    await supabaseAdmin
      .from('employer_wallets')
      .update({ repayment_due_date: null })
      .eq('employer_id', employerId);

    void notifyAdmin({
      type: 'system_alert',
      title: '✅ Payday Recoupment Collected',
      message: `${amount} collected from employer ${employerId}. Reference: ${paymentReference}.`,
      metadata: { recoupment_id: recoupmentId, employer_id: employerId, amount, reference: paymentReference },
    }).catch(() => {});
  } else {
    const finalStatus = hasRpcError ? 'failed' : 'partially_collected';
    await supabaseAdmin.from('payday_recoupments').update({
      status: finalStatus,
      amount_due: remainingDue,
      failure_reason: hasRpcError ? 'RPC execution error during collection application' : 'Partial collection received',
      updated_at: new Date().toISOString(),
    }).eq('id', recoupmentId);

    void notifyAdmin({
      type: 'system_alert',
      title: hasRpcError ? '❌ Payday Recoupment RPC Failed' : '⚠️ Payday Recoupment Partially Collected',
      message: `${amount} collected from employer ${employerId} (Remaining Due: ${remainingDue}). Reference: ${paymentReference}. Status: ${finalStatus}.`,
      metadata: { recoupment_id: recoupmentId, employer_id: employerId, amount_collected: amount, remaining_due: remainingDue, reference: paymentReference, hasRpcError },
    }).catch(() => {});
  }

  log.info('Payday recoupment collection processing complete', { recoupmentId, amount, isFullyCollected, remainingDue });
}
