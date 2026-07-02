import { supabaseAdmin } from '../supabaseAdmin';
import { notifyAdmin } from '../notifications';
import type { Logger } from '../logger';

// Shared by the DusuPay webhook (automated mobile money collection) and the admin
// manual-collect route (bank-transfer fallback when mobile money fails) — both
// need to apply a collected amount across an employer's outstanding repayment
// schedules the same way and mark the recoupment collected.
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
