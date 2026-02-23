import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    return NextResponse.json([]);
  }

  const { data: employeeRows, error: employeesError } = await supabase
    .from('employee_onboarding')
    .select('id, user_id, employee_code')
    .eq('employer_id', employer.id);

  if (employeesError) {
    return NextResponse.json({ error: employeesError.message }, { status: 500 });
  }

  const employeeIds = (employeeRows ?? []).map((e: any) => e.id);
  if (employeeIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data: advances, error: advancesError } = await supabase
    .from('advances')
    .select(
      'id, employee_id, amount, fee_amount, fee_percentage, net_amount, disbursement_method, status, created_at, requested_at, approved_at',
    )
    .in('employee_id', employeeIds)
    .order('created_at', { ascending: false });

  if (advancesError) {
    return NextResponse.json({ error: advancesError.message }, { status: 500 });
  }

  const employeeById = new Map<string, any>((employeeRows ?? []).map((e: any) => [e.id, e]));
  const profileIds = (employeeRows ?? []).map((e: any) => e.user_id).filter(Boolean);

  let profilesByUserId = new Map<string, any>();
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', profileIds);
    profilesByUserId = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));
  }

  const payload = (advances ?? []).map((a: any) => {
    const employee = employeeById.get(a.employee_id);
    const profile = employee?.user_id ? profilesByUserId.get(employee.user_id) : null;
    return {
      ...a,
      employee_name: profile?.full_name || employee?.employee_code || 'Employee',
      employee_code: employee?.employee_code || null,
    };
  });

  return NextResponse.json(payload);
}
