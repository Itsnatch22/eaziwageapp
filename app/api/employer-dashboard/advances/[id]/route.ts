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
  employee_onboarding?: {
    user_id?: string | null;
  } | null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
    .from('employer_onboarding')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (employerError) {
    return NextResponse.json({ error: employerError.message }, { status: 500 });
  }
  if (!employer) {
    return NextResponse.json({ error: 'Employer profile not found' }, { status: 404 });
  }

  const { data: employeeRows, error: employeesError } = await supabase
    .from('employee_onboarding')
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
    .select('id, status, amount, employee_id, employee_onboarding(user_id)')
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
    try {
      await payoutService.reserveFunds(employer.id, target.amount, id);

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
    const onboarding = target.employee_onboarding;
    const employeeUserId = Array.isArray(onboarding) 
      ? onboarding[0]?.user_id 
      : (onboarding as any)?.user_id;
    
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
