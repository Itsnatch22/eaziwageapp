import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'deny']),
});

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
    .select('id, status, employee_id')
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
  const update =
    action === 'approve'
      ? { status: 'approved', approved_at: nowIso, approved_by: user.id }
      : { status: 'rejected' };

  const { error: updateError } = await supabase
    .from('advances')
    .update(update)
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: action === 'approve' ? 'Advance approved' : 'Advance rejected',
    status: update.status,
  });
}
