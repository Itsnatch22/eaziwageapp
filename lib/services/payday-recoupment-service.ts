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
 */
export async function checkAndCreatePaydayRecoupment(
  employerId: string,
  employerUserId: string | null,
  employerCompanyName: string | null,
  fallbackPaydayDayOfMonth: number | null,
): Promise<PaydayRecoupmentRow | null> {
  const paydayDayOfMonth = await resolveEffectivePaydayDayOfMonth(
    employerId,
    fallbackPaydayDayOfMonth,
    supabaseAdmin,
  );

  if (!paydayDayOfMonth) return null;

  const today = new Date();
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const effectivePaydayDate = new Date(
    todayDateOnly.getFullYear(),
    todayDateOnly.getMonth(),
    clampDayToMonth(todayDateOnly.getFullYear(), todayDateOnly.getMonth(), paydayDayOfMonth),
  );
  const isPaydayToday = todayDateOnly.getTime() === effectivePaydayDate.getTime();
  const todayStr = todayDateOnly.toISOString().split('T')[0];

  // Any not-yet-resolved row (from today or a past cycle) keeps surfacing until
  // acted on — an employer shouldn't be able to make a prompt disappear by just
  // waiting for the day to pass.
  const { data: existing } = await supabaseAdmin
    .from('payday_recoupments')
    .select('*')
    .eq('employer_id', employerId)
    .in('status', ['pending_response', 'confirmed', 'collecting', 'failed'])
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

  const { data: created, error: createError } = await supabaseAdmin
    .from('payday_recoupments')
    .insert({
      employer_id: employerId,
      payday_date: todayStr,
      amount_due: amountDue,
      currency,
      status: 'pending_response',
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

  if (employerUserId) {
    void notifyEmployer({
      userId: employerUserId,
      type: 'system',
      title: 'Payday Recoupment Due',
      message: `Today is your payday — ${currency} ${amountDue.toLocaleString()} is due for recoupment. Visit Wallet & Funding to confirm.`,
      metadata: { recoupment_id: created.id, employer_id: employerId, amount_due: amountDue },
    }).catch(() => {});
  }

  void notifyAdmin({
    type: 'system_alert',
    title: `📅 Payday Recoupment Due — ${employerCompanyName ?? employerId}`,
    message: `${currency} ${amountDue.toLocaleString()} is due for recoupment today.`,
    metadata: { recoupment_id: created.id, employer_id: employerId, amount_due: amountDue },
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
  const { data: schedules } = await supabaseAdmin
    .from('repayment_schedules')
    .select('id, advance_id, repayment_amount')
    .eq('employer_id', employerId)
    .in('status', ['pending', 'overdue']);

  let remaining = amount;
  for (const schedule of schedules ?? []) {
    if (remaining <= 0) break;
    const scheduleAmount = Number(schedule.repayment_amount);
    const applied = Math.min(remaining, scheduleAmount);

    const { error: rpcError } = await supabaseAdmin.rpc('repay_advance_to_admin', {
      p_advance_id: schedule.advance_id,
      p_amount: applied,
    });

    if (rpcError) {
      // Leave this schedule pending rather than mark it paid without the RPC
      // having actually run — it'll be picked up by a future recoupment/cron pass.
      log.error('repay_advance_to_admin RPC failed during payday recoupment', { err: rpcError, scheduleId: schedule.id });
      continue;
    }

    await supabaseAdmin.from('repayment_schedules').update({
      status: 'paid',
      paid_amount: applied,
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
    } else {
      remaining = 0;
    }
  }

  await supabaseAdmin.from('payday_recoupments').update({
    status: 'collected',
    collected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', recoupmentId);

  void notifyAdmin({
    type: 'system_alert',
    title: '✅ Payday Recoupment Collected',
    message: `${amount} collected from employer ${employerId}. Reference: ${paymentReference}.`,
    metadata: { recoupment_id: recoupmentId, employer_id: employerId, amount, reference: paymentReference },
  }).catch(() => {});

  log.info('Payday recoupment collection complete', { recoupmentId, amount });
}
