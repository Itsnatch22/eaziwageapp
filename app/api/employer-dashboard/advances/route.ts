import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface EmployeeRow {
  id: string;
  user_id: string | null;
  employee_code: string | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
}

interface AdvanceRow {
  id: string;
  employee_id: string;
  amount: number | string | null;
  fee_amount: number | string | null;
  fee_percentage: number | string | null;
  net_amount: number | string | null;
  disbursement_method: string | null;
  status: string;
  created_at: string;
  requested_at: string | null;
  approved_at: string | null;
}

export async function GET(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    return NextResponse.json([]);
  }

  const { data: employeeRows, error: employeesError } = await supabase
    .from('employees')
    .select('id, user_id, employee_code')
    .eq('employer_id', employer.id);

  if (employeesError) {
    return NextResponse.json({ error: employeesError.message }, { status: 500 });
  }

  const typedEmployees = (employeeRows ?? []) as EmployeeRow[];
  const employeeIds = typedEmployees.map((e) => e.id);
  if (employeeIds.length === 0) {
    return NextResponse.json([]);
  }

  // BUGFIX: this endpoint had no pagination — `.order()` with no `.range()`
  // returns the entire advances history for every dashboard load. Fine at
  // low volume, a full table scan to the browser once volume grows.
  const url = new URL(req.url);
  const page = Math.max(Number(url.searchParams.get('page') ?? '1'), 1);
  const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? '50'), 1), 200);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: advances, error: advancesError } = await supabase
    .from('advances')
    .select(
      'id, employee_id, amount, fee_amount, fee_percentage, net_amount, disbursement_method, status, created_at, requested_at, approved_at',
    )
    .in('employee_id', employeeIds)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (advancesError) {
    return NextResponse.json({ error: advancesError.message }, { status: 500 });
  }

  const employeeById = new Map<string, EmployeeRow>(typedEmployees.map((e) => [e.id, e]));
  const profileIds = typedEmployees.map((e) => e.user_id).filter((id): id is string => Boolean(id));

  let profilesByUserId = new Map<string, ProfileRow>();
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', profileIds);
    profilesByUserId = new Map<string, ProfileRow>(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]));
  }

  const payload = ((advances ?? []) as AdvanceRow[]).map((a) => {
    const employee = employeeById.get(a.employee_id);
    // BUGFIX: previously this fell through silently to a generic 'Employee'
    // label with no trace. Now it's logged so an orphaned advance (employee
    // deleted/reassigned without the FK catching it) shows up in monitoring
    // instead of just looking like a row with a blank name.
    if (!employee) {
      console.error(`[employer-dashboard/advances] Orphaned advance ${a.id}: no employee for employee_id ${a.employee_id}`);
    }
    const profile = employee?.user_id ? profilesByUserId.get(employee.user_id) : null;
    return {
      ...a,
      employee_name: profile?.full_name || employee?.employee_code || 'Employee',
      employee_code: employee?.employee_code || null,
    };
  });

  return NextResponse.json(payload);
}