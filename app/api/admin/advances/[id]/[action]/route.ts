import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NextResponse, NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyEmployee, notifyEmployer } from '@/lib/notifications';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  context: AppRouteContext<{ id: string; action: string }>
) {
  const rateLimitResponse = await checkAdminRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const { id, action } = await context.params;
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const adminUser = auth;

  const supabase = await createRouteHandlerClient();

  if (!['approve', 'disburse', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  try {
    const { data: advance, error: getError } = await supabase
      .from('advances')
      .select('id, status, employee_id, employer_id, amount, fee_amount, approved_at')
      .eq('id', id)
      .maybeSingle();

    if (getError || !advance) {
      return NextResponse.json({ error: 'Advance not found' }, { status: 404 });
    }

    const VALID_TRANSITIONS: Record<string, string[]> = {
      approve:  ['pending'],
      reject:   ['pending', 'approved'],
      disburse: ['approved'],
    };

    const allowed = VALID_TRANSITIONS[action] ?? [];
    if (!allowed.includes(advance.status)) {
      return NextResponse.json(
        { error: `Cannot ${action} an advance with status '${advance.status}'` },
        { status: 409 }
      );
    }

    let newStatus: string;
    if (action === 'approve') {
      newStatus = 'approved';
    } else if (action === 'disburse') {
      newStatus = 'disbursed';
    } else if (action === 'reject') {
      newStatus = 'rejected';
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { data: employeeEwa } = await supabase
      .from('employee_ewa_settings')
      .select('ewa_enabled, max_advance_percentage, min_advance_amount, max_advance_amount')
      .eq('employee_id', advance.employee_id)
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
      // SCHEMA: eligibility columns live in employers (advance_limit_percent, cooldown_days),
      // not in employer_onboarding (max_advance_percentage, cooldown_period). Do not swap.
      const { data: employerRecord } = await supabase
        .from('employers')
        .select('advance_limit_percent, min_advance_amount, max_advance_amount')
        .eq('id', advance.employer_id)
        .maybeSingle();
      if (employerRecord) {
        effective.max_advance_percentage = employerRecord.advance_limit_percent ?? effective.max_advance_percentage;
        effective.min_advance_amount = Number(employerRecord.min_advance_amount ?? effective.min_advance_amount);
        effective.max_advance_amount = Number(employerRecord.max_advance_amount ?? effective.max_advance_amount);
      }
    }

    if (effective.ewa_enabled === false) {
      return NextResponse.json({ error: 'EWA access is disabled for this employee.' }, { status: 403 });
    }

    if (Number(advance.amount) < effective.min_advance_amount || Number(advance.amount) > effective.max_advance_amount) {
      return NextResponse.json({ error: 'Advance amount falls outside configured EWA limits.' }, { status: 422 });
    }

    const { error: updateError } = await supabase
      .from('advances')
      .update({
        status: newStatus,
        approved_at: newStatus === 'approved' ? new Date().toISOString() : advance.approved_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Audit trail — CBK requires every manual status change to have an attributable reviewer
    void supabaseAdmin.from('system_audit_logs').insert({
      admin_id: adminUser.user.id,
      admin_name: adminUser.user.email ?? adminUser.user.id,
      target_id: id,
      target_type: 'advance',
      action: `advance_${action}d`,
      old_value: { status: advance.status },
      new_value: { status: newStatus },
      metadata: { employee_id: advance.employee_id, employer_id: advance.employer_id, amount: advance.amount },
    });

    // Notify employee and employer of the status change (fire-and-forget — don't fail the request)
    void (async () => {
      try {
        const [{ data: empOnboarding }, { data: employerRow }] = await Promise.all([
          supabaseAdmin
            .from('employee_onboarding')
            .select('user_id, full_name, currency')
            .eq('id', advance.employee_id)
            .maybeSingle(),
          supabaseAdmin
            .from('employers')
            .select('user_id, company_name, contact_person, currency')
            .eq('id', advance.employer_id)
            .maybeSingle(),
        ]);

        const currency: string = empOnboarding?.currency ?? employerRow?.currency ?? 'KES';
        const employeeName: string = empOnboarding?.full_name ?? 'Employee';
        const now = new Date().toLocaleString();

        if (empOnboarding?.user_id) {
          if (newStatus === 'approved') {
            await notifyEmployee({
              userId: empOnboarding.user_id,
              type: 'advance_approval',
              title: 'Advance Approved',
              message: `Your advance of ${currency} ${Number(advance.amount).toLocaleString()} has been approved and is being processed.`,
              metadata: { advanceId: id, advanceAmount: advance.amount, currency, approvedAt: now, employeeName },
            });
          } else if (newStatus === 'rejected') {
            await notifyEmployee({
              userId: empOnboarding.user_id,
              type: 'advance_rejected',
              title: 'Advance Not Approved',
              message: `Your advance request of ${currency} ${Number(advance.amount).toLocaleString()} was not approved at this time.`,
              metadata: { advanceId: id, requestedAmount: advance.amount, currency, rejectedAt: now, employeeName },
            });
          } else if (newStatus === 'disbursed') {
            await notifyEmployee({
              userId: empOnboarding.user_id,
              type: 'advance_approval',
              title: 'Advance Disbursed',
              message: `Your advance of ${currency} ${Number(advance.amount).toLocaleString()} has been disbursed to your account.`,
              metadata: { advanceId: id, advanceAmount: advance.amount, currency, approvedAt: now, employeeName },
            });
          }
        }

        if (employerRow?.user_id && newStatus !== 'approved') {
          // Employer only needs a nudge on rejection/disbursal (they saw the request already)
          await notifyEmployer({
            userId: employerRow.user_id,
            type: 'advance_request_received',
            title: `Advance ${newStatus === 'rejected' ? 'Rejected' : 'Disbursed'}`,
            message: `${employeeName}'s advance of ${currency} ${Number(advance.amount).toLocaleString()} was ${newStatus}.`,
            metadata: {
              advanceId: id,
              employeeName,
              requestedAmount: advance.amount,
              currency,
              companyName: employerRow.company_name,
              contactPerson: employerRow.contact_person,
              requestedAt: now,
            },
          });
        }
      } catch (notifErr) {
        console.error('[AdminAdvancesAction] Notification error (non-fatal):', notifErr);
      }
    })();

    return NextResponse.json({
      success: true,
      message: `Advance ${newStatus}`,
      advance_id: id,
    });
  } catch (error: unknown) {
    console.error('[AdminAdvancesAction] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
