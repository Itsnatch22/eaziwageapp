import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { ewaSettingsSchema } from '@/lib/validations/employee-validation';
import { dbErrorResponse } from '@/lib/api-errors';


export async function PUT(
  req: NextRequest,
  { params }: IdRouteContext,
) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const employeeId = id;

  const { data: employer, error: employerError } = await supabase
    .from('employers')
    .select('id, onboarding_id, status')
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .maybeSingle();

  if (employerError) {
    return dbErrorResponse('employer-dashboard/ewa-settings', employerError);
  }

  if (!employer) {
    return NextResponse.json(
      { error: 'Approved employer profile not found.' },
      { status: 403 },
    );
  }

  const { data: employee, error: empError } = await supabase
    .from('employee_onboarding')
    .select('id, employer_id, user_id')
    .eq('id', employeeId)
    .eq('employer_id', employer.onboarding_id)
    .maybeSingle();

  if (empError) {
    return dbErrorResponse('employer-dashboard/ewa-settings', empError);
  }

  if (!employee) {
    return NextResponse.json(
      { error: 'Employee not found or does not belong to your organization.' },
      { status: 404 },
    );
  }

  const { data: liveEmployee, error: liveEmployeeError } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', employee.user_id)
    .maybeSingle();

  if (liveEmployeeError) {
    return dbErrorResponse('employer-dashboard/ewa-settings', liveEmployeeError);
  }

  if (!liveEmployee) {
    return NextResponse.json(
      { error: 'Employee has not been activated yet. EWA settings require an active employee record.' },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const coerced = {
    ...body,
    max_advance_percentage: Number(body.max_advance_percentage),
    min_advance_amount: Number(body.min_advance_amount),
    max_advance_amount: Number(body.max_advance_amount),
    cooldown_period: Number(body.cooldown_period),
  };

  const parsed = ewaSettingsSchema.safeParse(coerced);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((e) => ({
      field: e.path.join('.'),
      msg: e.message,
    }));
    return NextResponse.json({ error: 'Validation failed', detail }, { status: 422 });
  }

  const data = parsed.data;

  const { error: upsertError } = await supabase
    .from('employee_ewa_settings')
    .upsert(
      {
        employee_id: liveEmployee.id,
        employee_onboarding_id: employee.id,
        employer_id: employer.onboarding_id,
        employer_live_id: employer.id,
        ewa_enabled: data.ewa_enabled,
        max_advance_percentage: data.max_advance_percentage,
        min_advance_amount: data.min_advance_amount,
        max_advance_amount: data.max_advance_amount,
        cooldown_period: data.cooldown_period,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'employee_id' },
    );

  if (upsertError) {
    return dbErrorResponse('employer-dashboard/ewa-settings', upsertError, 'Failed to save EWA settings. Please try again.');
  }

  return NextResponse.json({
    message: 'EWA settings updated successfully.',
    settings: data,
  });
}
