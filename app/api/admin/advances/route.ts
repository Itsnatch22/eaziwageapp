import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import { getCurrencyFromCountry } from '@/lib/utils';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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
  employees?: {
    country?: string | null;
  };
}

interface EmployeeRow {
  id: string;
  user_id: string | null;
  employee_code: string | null;
}

interface EmployerRow {
  id: string;
  user_id: string | null;
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
    const { data: advances, error: advancesError } = await supabaseAdmin
      .from('advances')
      .select(
        'id, employee_id, organization_id, amount, fee_amount, fee_percentage, net_amount, disbursement_method, status, created_at, requested_at, approved_at, employer_id, employees!advances_employee_id_fkey(country)',
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
      // First, try to resolve advances.employee_id as employees.id
      const { data: employees } = await supabaseAdmin
        .from('employees')
        .select('id, user_id, employee_code')
        .in('id', employeeIds);

      employeeById = new Map<string, EmployeeRow>(((employees ?? []) as EmployeeRow[]).map((e) => [e.id, e]));

      // Collect user_ids from resolved employees to fetch profiles
      const profileIds = (employees ?? []).map((e) => e.user_id).filter((id): id is string => Boolean(id));
      if (profileIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name')
          .in('id', profileIds);

        profilesByUserId = new Map<string, ProfileRow>(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]));
      }

      // If some advances reference employee_onboarding.id instead of employees.id, resolve those too
      const missingIds = employeeIds.filter((id) => !employeeById.has(id));
      if (missingIds.length > 0) {
        const { data: onboardings } = await supabaseAdmin
          .from('employee_onboarding')
          .select('id, user_id, employee_code')
          .in('id', missingIds as string[]);

        const onboardingUserIds = (onboardings ?? []).map((o: any) => o.user_id).filter((id: any): id is string => Boolean(id));
        if (onboardingUserIds.length > 0) {
          const { data: employeesByUser } = await supabaseAdmin
            .from('employees')
            .select('id, user_id, employee_code')
            .in('user_id', onboardingUserIds as string[]);

          const byUser = new Map<string, EmployeeRow>(((employeesByUser ?? []) as EmployeeRow[]).map((e) => [e.user_id as string, e]));

          // Map onboarding.id -> corresponding employees row (if found by user_id)
          (onboardings ?? []).forEach((o: any) => {
            const matched = o && o.user_id ? byUser.get(o.user_id) : undefined;
            if (matched) {
              employeeById.set(o.id, matched);
              // ensure profile mapping exists for the matched user
              if (matched.user_id) profilesByUserId.set(matched.user_id, profilesByUserId.get(matched.user_id) || { id: matched.user_id, full_name: null });
            }
          });
        }
      }
    }

if (employerIds.length > 0) {
  const { data: employers } = await supabaseAdmin
    .from('employers') 
    .select('id, company_name')
    .in('id', employerIds);

  employerById = new Map<string, EmployerRow>(((employers ?? []) as EmployerRow[]).map((e) => [e.id, e]));
}

const payload = typedAdvances.map((a) => {
  const employee = employeeById.get(a.employee_id);
  const employer = employerById.get(a.employer_id);
  const profile = employee?.user_id ? profilesByUserId.get(employee.user_id) : null;
  const sourceCurrency = getCurrencyFromCountry(a.employees?.country, 'KES');

  return {
    ...a,
    currency: sourceCurrency,
    employee_name: profile?.full_name || employee?.employee_code || 'Employee',
    employee_code: employee?.employee_code || null,
    employer_name: employer?.company_name || 'Unknown',
  };
});

    return NextResponse.json({ advances: payload });
  } catch (error: unknown) {
    console.error('[AdminAdvances] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
