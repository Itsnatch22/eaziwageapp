import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { payoutService } from '@/lib/services/payout-service';
import { notifyEmployee, notifyAdmin } from '@/lib/notifications';

interface AutoApproveParams {
  advanceId: string;
  employeeId: string;       // employees.id (advances.employee_id FK)
  employeeUserId: string;   // auth user id, for notifications
  employeeName?: string;
  employerId: string;       // employers.id (live)
  employerName?: string;
  amount: number;
  maxAdvancePercentage: number;
  monthlySalary: number;
}

// Mirrors the reserve/disburse mechanics of the employer's manual "approve" action
// (app/api/employer-dashboard/advances/[id]/route.ts) so an employer that opts into
// straight-through processing (employers.auto_approve = true, gated by the platform-
// wide Global Settings "Auto-Approval" toggle) doesn't need a human to click approve
// at all. Deliberately built as a separate, additive path rather than refactoring the
// existing manual route, to avoid any regression risk to that already-live flow.
//
// Never throws — if any check fails or an unexpected error occurs, the advance is
// simply left 'pending' for a human to review via the normal employer dashboard,
// exactly as if auto-approval had never been attempted. Auto-approval is a
// convenience layer on top of manual review, never a replacement path that can fail
// the employee's request outright.
export async function tryAutoApproveAdvance(params: AutoApproveParams): Promise<void> {
  const {
    advanceId, employeeId, employeeUserId, employeeName,
    employerId, employerName, amount, maxAdvancePercentage, monthlySalary,
  } = params;

  try {
    // The admin Settings toggle is explicitly labeled "Auto-Approval for LOW RISK" —
    // only employees at/above the admin-configured low-risk threshold qualify (same
    // threshold and 4.0 default used by app/api/admin/settings/employees/route.ts's
    // risk classification). risk_score is 0–5 where HIGHER = SAFER. Anyone below the
    // threshold just falls through to normal manual review, same as auto-approval
    // being off entirely.
    const [{ data: employeeRow }, { data: globalRow }] = await Promise.all([
      supabaseAdmin.from('employees').select('risk_score').eq('id', employeeId).maybeSingle(),
      supabaseAdmin.from('global_settings').select('risk_settings').eq('id', 'default').maybeSingle(),
    ]);

    const lowRiskThreshold = (globalRow?.risk_settings as { employee_low_threshold?: number } | null)?.employee_low_threshold ?? 4.0;
    const employeeRiskScore = Number(employeeRow?.risk_score ?? 0);

    if (employeeRiskScore < lowRiskThreshold) {
      return;
    }

    // Cumulative monthly cap — request-advance/route.ts already validated this single
    // request against monthly_salary% before insert, but not the running total of
    // OTHER advances already approved this month. Same check the manual route performs.
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data: approvedThisMonth } = await supabaseAdmin
      .from('advances')
      .select('amount')
      .eq('employee_id', employeeId)
      .eq('status', 'approved')
      .gte('requested_at', startOfMonth);

    const totalAccessed = (approvedThisMonth ?? []).reduce(
      (sum, a: { amount: number | string | null }) => sum + Number(a.amount), 0,
    );
    const maxThisMonth = monthlySalary * (maxAdvancePercentage / 100);

    if (monthlySalary > 0 && totalAccessed + amount > maxThisMonth) {
      // Leave 'pending' — the employer can still review and approve manually,
      // e.g. if they want to make a case-by-case exception.
      return;
    }

    const { data: employer } = await supabaseAdmin
      .from('employers')
      .select('funding_model, funding_buffer_percent, credit_limit')
      .eq('id', employerId)
      .maybeSingle();

    if (!employer) return;

    const nowIso = new Date().toISOString();

    // Same atomic claim as the manual route — only proceeds if still 'pending',
    // so a human clicking approve/reject at the same moment can't race this.
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('advances')
      .update({ status: 'approved', approved_at: nowIso, approved_by: null })
      .eq('id', advanceId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (claimError || !claimed) return;

    const fundingModel = employer.funding_model ?? 'prefunded';

    if (fundingModel === 'prefunded') {
      try {
        await payoutService.reserveFunds(employerId, amount, advanceId);
      } catch (reserveErr) {
        // Insufficient balance or similar — release the claim back to 'pending'
        // so a human can review (e.g. after the employer tops up).
        await supabaseAdmin
          .from('advances')
          .update({ status: 'pending', approved_at: null, approved_by: null })
          .eq('id', advanceId);
        console.error(`[auto-approve] reserveFunds failed for advance ${advanceId}:`, reserveErr);
        return;
      }
    } else {
      const { data: wallet } = await supabaseAdmin
        .from('employer_wallets')
        .select('outstanding_liability')
        .eq('employer_id', employerId)
        .maybeSingle();

      const creditLimit = Number(employer.credit_limit ?? 5_000_000);
      const bufferPercent = Number(employer.funding_buffer_percent ?? 20);
      const cap = creditLimit * (1 + bufferPercent / 100);
      const projectedLiability = Number(wallet?.outstanding_liability ?? 0) + amount;

      if (projectedLiability > cap) {
        await supabaseAdmin
          .from('advances')
          .update({ status: 'pending', approved_at: null, approved_by: null })
          .eq('id', advanceId);
        return;
      }

      const { error: liabilityError } = await supabaseAdmin
        .from('employer_wallets')
        .upsert(
          { employer_id: employerId, outstanding_liability: projectedLiability, updated_at: new Date().toISOString() },
          { onConflict: 'employer_id' },
        );

      if (liabilityError) {
        console.error(`[auto-approve] Failed to record ${fundingModel} liability for ${advanceId}:`, liabilityError);
      }
    }

    void notifyEmployee({
      userId: employeeUserId,
      type: 'advance_approval',
      title: 'Advance Approved!',
      message: 'Your advance request has been automatically approved and is now being processed for disbursement.',
      metadata: { advance_id: advanceId, status: 'approved' },
    }).catch(() => {});

    payoutService.disburseAdvance(advanceId).catch(async (err) => {
      const reason = err instanceof Error ? err.message : 'Disbursement failed';
      console.error(`[auto-approve] Disbursement failed for ${advanceId}:`, reason);

      await supabaseAdmin
        .from('advances')
        .update({ status: 'failed', reason })
        .eq('id', advanceId)
        .eq('status', 'approved');

      if (fundingModel === 'prefunded') {
        const { error: releaseError } = await supabaseAdmin.rpc('release_employer_reservation', {
          p_employer_id: employerId,
          p_amount: amount,
          p_advance_id: advanceId,
        });
        if (releaseError) {
          console.error(`[auto-approve] Failed to release reservation for ${advanceId}:`, releaseError.message);
        }
      } else {
        const { data: wallet } = await supabaseAdmin
          .from('employer_wallets')
          .select('outstanding_liability')
          .eq('employer_id', employerId)
          .maybeSingle();

        await supabaseAdmin
          .from('employer_wallets')
          .update({
            outstanding_liability: Math.max(0, Number(wallet?.outstanding_liability ?? 0) - amount),
            updated_at: new Date().toISOString(),
          })
          .eq('employer_id', employerId);
      }

      void notifyAdmin({
        type: 'system_alert',
        title: 'Advance Disbursement Failed',
        message: `Auto-approved advance for ${employeeName ?? 'an employee'} (${employerName ?? 'employer'}) failed: ${reason}. Manual intervention required.`,
        metadata: { advance_id: advanceId, employer_id: employerId, employee_name: employeeName, employer_name: employerName, reason },
      }).catch(() => {});

      void notifyEmployee({
        userId: employeeUserId,
        type: 'advance_approval',
        title: 'Disbursement Delayed',
        message: 'Your advance was approved but there was a delay sending the funds. Our team has been notified and will resolve this shortly.',
        metadata: { advance_id: advanceId },
      }).catch(() => {});
    });
  } catch (err) {
    console.error(`[auto-approve] Unexpected error for advance ${advanceId}:`, err);
  }
}
