import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { checkAdminAccess } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';

interface AdvanceRow {
  id: string;
  employee_id: string;
  organization_id: string;
  amount: number | string | null;
  fee_amount: number | string | null;
  fee_percentage: number | string | null;
  net_amount: number | string | null;
  disbursement_method: string | null;
  status: string;
  created_at: string;
  requested_at: string | null;
  approved_at: string | null;
  employer_id: string;
  employee_onboarding?: {
    currency?: string | null;
  };
}

interface EmployeeRow {
  id: string;
  user_id: string | null;
  employee_code: string | null;
}

interface EmployerRow {
  id: string;
  company_name: string | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
}

export async function GET() {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminSupabase = await createRouteHandlerClient();
  const adminResult = await checkAdminAccess({
    user,
    adminSupabase,
  });

  if (!adminResult.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data: advances, error: advancesError } = await supabase
      .from('advances')
      .select(
        'id, employee_id, organization_id, amount, fee_amount, fee_percentage, net_amount, disbursement_method, status, created_at, requested_at, approved_at, employer_id, employee_onboarding(currency)',
      )
      .order('created_at', { ascending: false });

    if (advancesError) {
      return NextResponse.json({ error: advancesError.message }, { status: 500 });
    }

    const typedAdvances = (advances ?? []) as AdvanceRow[];

    const employeeIds = typedAdvances.map((a) => a.employee_id);
    const employerIds = typedAdvances.map((a) => a.employer_id).filter(Boolean);

    let employeeById = new Map<string, EmployeeRow>();
    let employerById = new Map<string, EmployerRow>();
    let profilesByUserId = new Map<string, ProfileRow>();

    if (employeeIds.length > 0) {
      const { data: employees } = await supabase
        .from('employee_onboarding')
        .select('id, user_id, employee_code')
        .in('id', employeeIds);

      employeeById = new Map<string, EmployeeRow>(((employees ?? []) as EmployeeRow[]).map((e) => [e.id, e]));

      const profileIds = (employees ?? []).map((e) => e.user_id).filter((id): id is string => Boolean(id));
      if (profileIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', profileIds);

        profilesByUserId = new Map<string, ProfileRow>(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]));
      }
    }

    if (employerIds.length > 0) {
      const { data: employers } = await supabase
        .from('employers') 
        .select('id, company_name')
        .in('id', employerIds);

      employerById = new Map<string, EmployerRow>(((employers ?? []) as EmployerRow[]).map((e) => [e.id, e]));
    }

    const payload = typedAdvances.map((a) => {
      const employee = employeeById.get(a.employee_id);
      const employer = employerById.get(a.employer_id);
      const profile = employee?.user_id ? profilesByUserId.get(employee.user_id) : null;
      const sourceCurrency = a.employee_onboarding?.currency || 'KES';

      return {
        ...a,
        currency: sourceCurrency,
        employee_name: profile?.full_name || employee?.employee_code || 'Employee',
        employee_code: employee?.employee_code || null,
        employer_name: employer?.company_name || 'Unknown',
      };
    });

    return NextResponse.json(payload);
  } catch (error: unknown) {
    console.error('[AdminAdvances] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
