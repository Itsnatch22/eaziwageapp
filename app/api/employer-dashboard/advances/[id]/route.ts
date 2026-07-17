import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { notifyEmployee, notifyAdmin } from '@/lib/notifications';
import { payoutService } from '@/lib/services/payout-service';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { dbErrorResponse } from '@/lib/api-errors';

export const runtime = 'nodejs';

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'deny']),
});

interface AdvanceRow {
  id: string;
  status: string;
  amount: number;
  employee_id: string;
  employees?: {
    user_id?: string | null;
  } | null;
}

export async function PATCH(
  req: NextRequest,
  { params }: IdRouteContext,
) {
  const { id } = await params;
  const supabase = await createRouteHandlerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 422 });
  }

  const { data: employer, error: employerError } = await supabase
    .from('employers')
    .select('id, onboarding_id, funding_model, funding_buffer_percent, credit_limit')
    .eq('user_id', user.id)
    .maybeSingle();

  if (employerError) {
    return dbErrorResponse('employer-dashboard/advances/[id]', employerError);
  }
  if (!employer) {
    return NextResponse.json({ error: 'Advance approvals are available once your account is approved.' }, { status: 403 });
  }

  const { data: employeeRows, error: employeesError } = await supabase
    .from('employees')
    .select('id')
    .eq('employer_id', employer.id);

  if (employeesError) {
    return dbErrorResponse('employer-dashboard/advances/[id]', employeesError);
  }

  const employeeIds = (employeeRows ?? []).map((e: { id: string }) => e.id);
  if (employeeIds.length === 0) {
    return NextResponse.json({ error: 'No employees found' }, { status: 404 });
  }

  const { data: target, error: targetError } = await supabase
    .from('advances')
    .select('id, status, amount, employee_id, employees(user_id)')
    .eq('id', id)
    .in('employee_id', employeeIds)
    .maybeSingle();

  if (targetError) {
    return dbErrorResponse('employer-dashboard/advances/[id]', targetError);
  }

  if (!target) {
    return NextResponse.json({ error: 'Advance not found' }, { status: 404 });
  }

  const action = parsed.data.action;
  const nowIso = new Date().toISOString();

  if (action === 'approve') {

    // target.employees.user_id is already fetched in the advance select above
    const employeeEntry = target.employees;
    const employeeUserId = Array.isArray(employeeEntry)
      ? employeeEntry[0]?.user_id
      : (employeeEntry as { user_id?: string | null } | null)?.user_id;

    // BUGFIX: don't let a missing user_id link silently flow through as a
    // fake 0 salary further down (it used to surface as a confusing
    // "Monthly limit reached" error masking a data-integrity problem).
    if (!employeeUserId) {
      console.error(`[Advance Approval] No linked user_id for employee ${target.employee_id}, advance ${id}`);
      return NextResponse.json(
        { error: 'Employee account is not fully linked. Contact support.' },
        { status: 422 },
      );
    }

    const [{ data: employerOnboardingRow }, { data: employeeOnboardingRow }, { data: empRow }] = await Promise.all([
      supabase.from('employer_onboarding').select('company_name').eq('id', employer.onboarding_id).maybeSingle(),
      supabase.from('employee_onboarding').select('full_name').eq('user_id', employeeUserId).maybeSingle(),
      supabase.from('employee_onboarding').select('monthly_salary').eq('user_id', employeeUserId).maybeSingle(),
    ]);

    const employerName = employerOnboardingRow?.company_name ?? 'Unknown Company';
    const employeeName = (employeeOnboardingRow as { full_name?: string | null } | null)?.full_name ?? 'Unknown Employee';

    // employee_ewa_settings.employee_id → employees.id (target.employee_id is advances.employee_id → employees.id)
    const { data: employeeEwa } = await supabase
      .from('employee_ewa_settings')
      .select('ewa_enabled, max_advance_percentage, min_advance_amount, max_advance_amount')
      .eq('employee_id', target.employee_id)
      .maybeSingle();

    let effective = {
      ewa_enabled: true,
      max_advance_percentage: 50,
      min_advance_amount: 500,
      max_advance_amount: 50000,
    };

    if (employeeEwa) {
      effective = {
        ewa_enabled: employeeEwa.ewa_enabled ?? effective.ewa_enabled,
        max_advance_percentage: employeeEwa.max_advance_percentage ?? effective.max_advance_percentage,
        min_advance_amount: Number(employeeEwa.min_advance_amount ?? effective.min_advance_amount),
        max_advance_amount: Number(employeeEwa.max_advance_amount ?? effective.max_advance_amount),
      };
    } else {
      const { data: employerOnboarding } = await supabase
        .from('employer_onboarding')
        .select('max_advance_percentage, min_advance_amount, max_advance_amount')
        .eq('id', employer.onboarding_id)
        .maybeSingle();
      if (employerOnboarding) {
        effective.max_advance_percentage = employerOnboarding.max_advance_percentage ?? effective.max_advance_percentage;
        effective.min_advance_amount = Number(employerOnboarding.min_advance_amount ?? effective.min_advance_amount);
        effective.max_advance_amount = Number(employerOnboarding.max_advance_amount ?? effective.max_advance_amount);
      }
    }

    if (effective.ewa_enabled === false) {
      return NextResponse.json({ error: 'EWA access is disabled for this employee.' }, { status: 403 });
    }


    const salary = Number(empRow?.monthly_salary ?? 0);
    const pct = (Number(effective.max_advance_percentage) || 50) / 100;
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data: approvedThisMonth } = await supabase
      .from('advances')
      .select('amount')
      .eq('employee_id', target.employee_id)
      .eq('status', 'approved')
      .gte('requested_at', startOfMonth);

    const totalAccessed = (approvedThisMonth ?? []).reduce((sum, a: { amount: number | string | null }) => sum + Number(a.amount), 0);
    const maxThisMonth = salary * pct;

    if (totalAccessed + Number(target.amount) > maxThisMonth) {
      return NextResponse.json({ error: 'Monthly limit reached. Employee must settle pending advances first.' }, { status: 400 });
    }

    if (Number(target.amount) < effective.min_advance_amount || Number(target.amount) > effective.max_advance_amount) {
      return NextResponse.json({ error: 'Requested amount falls outside configured EWA limits.' }, { status: 422 });
    }

    try {
      // BUGFIX: atomically claim the advance BEFORE reserving funds. The old
      // order (reserve funds, then update status) let two concurrent
      // requests on the same advance both pass the earlier read and both
      // reserve + disburse. The `.eq('status', 'pending')` guard here means
      // only one concurrent request can ever flip the row — the other gets
      // back `claimed === null` and is rejected with 409.
      const { data: claimed, error: claimError } = await supabase
        .from('advances')
        .update({ status: 'approved', approved_at: nowIso, approved_by: user.id })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (claimError) throw claimError;
      if (!claimed) {
        return NextResponse.json({ error: 'Advance already processed' }, { status: 409 });
      }

      // Funding Model (Employer Config settings): 'prefunded' (default) requires
      // the employer's wallet to already hold the money — reserveFunds enforces
      // that hard balance check. 'debit_order'/'invoice' employers aren't
      // pre-funded at all; instead of a balance check, they get a softer cap —
      // outstanding liability (what they already owe, tracked at funding time
      // for prefunded employers, but accrued per-disbursement here since there
      // was no funding event) plus this advance can't exceed their credit limit
      // padded by funding_buffer_percent.
      const fundingModel = employer.funding_model ?? 'prefunded';
      if (fundingModel === 'prefunded') {
        try {
          await payoutService.reserveFunds(employer.id, target.amount, id);
        } catch (reserveErr) {
          // Couldn't reserve funds — release the claim so the advance isn't
          // stuck "approved" with no reservation behind it.
          await supabase
            .from('advances')
            .update({ status: 'pending', approved_at: null, approved_by: null })
            .eq('id', id);
          throw reserveErr;
        }
      } else {
        const { data: wallet } = await supabaseAdmin
          .from('employer_wallets')
          .select('outstanding_liability')
          .eq('employer_id', employer.id)
          .maybeSingle();

        const creditLimit = Number(employer.credit_limit ?? 5_000_000);
        const bufferPercent = Number(employer.funding_buffer_percent ?? 20);
        const cap = creditLimit * (1 + bufferPercent / 100);
        const projectedLiability = Number(wallet?.outstanding_liability ?? 0) + Number(target.amount);

        if (projectedLiability > cap) {
          await supabase
            .from('advances')
            .update({ status: 'pending', approved_at: null, approved_by: null })
            .eq('id', id);
          return NextResponse.json({
            error: `Approving this would push outstanding liability to ${projectedLiability.toFixed(2)}, over the ${fundingModel} cap of ${cap.toFixed(2)} (credit limit + ${bufferPercent}% buffer).`,
          }, { status: 422 });
        }

        const { error: liabilityError } = await supabaseAdmin
          .from('employer_wallets')
          .upsert(
            { employer_id: employer.id, outstanding_liability: projectedLiability, updated_at: new Date().toISOString() },
            { onConflict: 'employer_id' },
          );

        if (liabilityError) {
          console.error(`[Advance Approval] Failed to record ${fundingModel} liability for ${id}:`, liabilityError);
        }
      }

      payoutService.disburseAdvance(id).catch(async (err) => {
        const reason = err instanceof Error ? err.message : 'Disbursement failed';
        console.error(`[Advance Approval] Disbursement failed for ${id}:`, reason);

        // Mark as failed so it doesn't sit at 'approved' forever
        await supabaseAdmin
          .from('advances')
          .update({ status: 'failed', reason })
          .eq('id', id)
          .eq('status', 'approved');

        if (fundingModel === 'prefunded') {
          // Release the wallet reservation so the employer's available balance
          // isn't permanently understated by this phantom reservation.
          const { error: releaseError } = await supabaseAdmin.rpc('release_employer_reservation', {
            p_employer_id: employer.id,
            p_amount: target.amount,
            p_advance_id: id,
          });

          if (releaseError) {
            console.error(`[Advance Approval] Failed to release reservation for ${id}:`, releaseError.message);
            // Best-effort cleanup — don't throw. Admin alert below provides visibility
            // for manual recovery if needed.
          }
        } else {
          // debit_order/invoice: the liability was recorded optimistically at
          // approval time (see above) since there's no reserveFunds hold for
          // these funding models — back it out now that disbursement failed.
          const { data: wallet } = await supabaseAdmin
            .from('employer_wallets')
            .select('outstanding_liability')
            .eq('employer_id', employer.id)
            .maybeSingle();

          const { error: releaseError } = await supabaseAdmin
            .from('employer_wallets')
            .update({
              outstanding_liability: Math.max(0, Number(wallet?.outstanding_liability ?? 0) - Number(target.amount)),
              updated_at: new Date().toISOString(),
            })
            .eq('employer_id', employer.id);

          if (releaseError) {
            console.error(`[Advance Approval] Failed to release ${fundingModel} liability for ${id}:`, releaseError.message);
          }
        }

        void notifyAdmin({
          type: 'system_alert',
          title: 'Advance Disbursement Failed',
          message: `Advance for ${employeeName} (${employerName}) failed: ${reason}. Manual intervention required. `,
          metadata: { advance_id: id, employer_id: employer.id, employee_name: employeeName, employer_name: employerName, reason },
        }).catch(() => {});

        if (employeeUserId) {
          void notifyEmployee({
            userId: employeeUserId,
            type: 'advance_approval',
            title: 'Disbursement Delayed',
            message: 'Your advance was approved but there was a delay sending the funds. Our team has been notified and will resolve this shortly.',
            metadata: { advance_id: id },
          }).catch(() => {});
        }
      });

    } catch (err: unknown) {
      console.error('[Advance Approval] Error:', err);
      return NextResponse.json({ error: 'Unable to approve advance. Please try again.' }, { status: 400 });
    }
  } else {
    const { error: updateError } = await supabase
      .from('advances')
      .update({ status: 'rejected' })
      .eq('id', id);

    if (updateError) {
      return dbErrorResponse('employer-dashboard/advances/[id]', updateError);
    }
  }

  try {
    const targetRow = target as AdvanceRow;
    const employee = targetRow.employees;
    const employeeUserId = Array.isArray(employee)
      ? employee[0]?.user_id
      : employee?.user_id;

    if (employeeUserId) {
        await notifyEmployee({
            userId: employeeUserId,
            type: 'advance_approval',
            title: action === 'approve' ? 'Advance Approved!' : 'Advance Rejected',
            message: action === 'approve'
                ? 'Your advance request has been approved and is now being processed for disbursement.'
                : 'Your advance request was not approved. Check your dashboard for details.',
            metadata: { advance_id: id, status: action === 'approve' ? 'approved' : 'rejected' }
        });
    }
  } catch (notifyErr) {
    console.error('[employer-advance-update] Notification failed:', notifyErr);
  }

  return NextResponse.json({
    message: action === 'approve' ? 'Advance approved and disbursement initiated' : 'Advance rejected',
    status: action === 'approve' ? 'approved' : 'rejected',
  });
}