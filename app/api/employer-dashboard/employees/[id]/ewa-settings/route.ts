
import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { ewaSettingsSchema } from '@/lib/validations/employee-validation';

export const runtime = 'edge';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id } = await params;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const employeeId = id;

  // ── Resolve employer ──────────────────────────────────────────────────────
  const { data: employer, error: employerError } = await supabase
    .from('employer_onboarding')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (employerError) {
    return NextResponse.json({ error: employerError.message }, { status: 500 });
  }

  if (!employer) {
    return NextResponse.json(
      { error: 'Approved employer profile not found.' },
      { status: 403 },
    );
  }

  // ── Verify the employee belongs to this employer ───────────────────────────
  const { data: employee, error: empError } = await supabase
    .from('employee_onboarding')
    .select('id, employer_id')
    .eq('id', employeeId)
    .eq('employer_id', employer.id)
    .maybeSingle();

  if (empError) {
    return NextResponse.json({ error: empError.message }, { status: 500 });
  }

  if (!employee) {
    return NextResponse.json(
      { error: 'Employee not found or does not belong to your organization.' },
      { status: 404 },
    );
  }

  // ── Parse & validate body ─────────────────────────────────────────────────
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Coerce number fields — the UI sends them as numbers already, but be safe
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

  // ── Upsert EWA settings ───────────────────────────────────────────────────
  const { error: upsertError } = await supabase
    .from('employee_ewa_settings')
    .upsert(
      {
        employee_onboarding_id: employee.id,
        employer_id: employer.id,
        ewa_enabled: data.ewa_enabled,
        max_advance_percentage: data.max_advance_percentage,
        min_advance_amount: data.min_advance_amount,
        max_advance_amount: data.max_advance_amount,
        cooldown_period: data.cooldown_period,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'employee_onboarding_id' },
    );

  if (upsertError) {
    console.error('[ewa-settings/upsert]', upsertError);
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: 'EWA settings updated successfully.',
    settings: data,
  });
}
