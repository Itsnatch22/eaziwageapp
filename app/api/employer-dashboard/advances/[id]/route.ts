import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { notifyEmployee } from '@/lib/notifications';
import { payoutService } from '@/lib/services/payout-service';

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
    .select('id, onboarding_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (employerError) {
    return NextResponse.json({ error: employerError.message }, { status: 500 });
  }
  if (!employer) {
    return NextResponse.json({ error: 'Employer profile not found' }, { status: 404 });
  }

  const { data: employeeRows, error: employeesError } = await supabase
    .from('employees')
    .select('id')
    .eq('employer_id', employer.id);

  if (employeesError) {
    return NextResponse.json({ error: employeesError.message }, { status: 500 });
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
    return NextResponse.json({ error: targetError.message }, { status: 500 });
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

    const { data: empRow } = await supabase
      .from('employee_onboarding')
      .select('monthly_salary')
      .eq('user_id', employeeUserId)
      .maybeSingle();

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
      await payoutService.reserveFunds(employer.onboarding_id, target.amount, id);

      const { error: updateError } = await supabase
        .from('advances')
        .update({ status: 'approved', approved_at: nowIso, approved_by: user.id })
        .eq('id', id);

      if (updateError) throw updateError;

      payoutService.disburseAdvance(id).catch(err => {
        console.error(`[Advance Approval] Disbursement failed for ${id}:`, err);
      });

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to approve advance';
      console.error(`[Advance Approval] Error: ${message}`);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } else {
    const { error: updateError } = await supabase
      .from('advances')
      .update({ status: 'denied' })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
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
            metadata: { advance_id: id, status: action === 'approve' ? 'approved' : 'denied' }
        });
    }
  } catch (notifyErr) {
    console.error('[employer-advance-update] Notification failed:', notifyErr);
  }

  return NextResponse.json({
    message: action === 'approve' ? 'Advance approved and disbursement initiated' : 'Advance denied',
    status: action === 'approve' ? 'approved' : 'denied',
  });
}
