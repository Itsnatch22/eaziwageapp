import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { isAdminRole } from '@/lib/validations/kyc-validation';
import { createRouteHandlerClient } from '@/utils/supabase/server';

type AdminEmployerStatus = 'approved' | 'pending' | 'rejected' | 'suspended';

function toAdminStatus(status: string | null | undefined): AdminEmployerStatus {
  if (status === 'approved' || status === 'rejected' || status === 'suspended') return status;
  return 'pending';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-employers:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers }
    );
  }

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401, headers: rateResult.headers }
    );
  }

  const env = getEnv();
  const adminSupabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string | null }>();

  if (profileError) {
    return NextResponse.json(
      { error: 'Failed to verify role.', code: 'ROLE_CHECK_FAILED' },
      { status: 500, headers: rateResult.headers }
    );
  }

  const roleCandidates = [profile?.role, user.app_metadata?.role, user.user_metadata?.role]
    .filter((r): r is string => typeof r === 'string' && r.length > 0)
    .map((r) => r.toLowerCase());

  if (!roleCandidates.some((r) => isAdminRole(r as any))) {
    return NextResponse.json(
      { error: 'Forbidden. Admin access required.', code: 'FORBIDDEN' },
      { status: 403, headers: rateResult.headers }
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const statusFilter = searchParams.get('status')?.trim() ?? '';
  const countryFilter = searchParams.get('country')?.trim() ?? '';
  const searchFilter = searchParams.get('search')?.trim().toLowerCase() ?? '';

  const { data: onboardingRows, error } = await adminSupabase
    .from('employer_onboarding')
    .select(
      `
      id,
      user_id,
      company_name,
      company_code,
      industry,
      country,
      registration_number,
      tax_id,
      physical_address,
      contact_person,
      contact_email,
      contact_phone,
      payroll_cycle,
      status,
      risk_score,
      created_at,
      updated_at
    `
    )
    .in('status', ['submitted', 'approved', 'rejected', 'suspended'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[GET /api/admin/employers] Supabase error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employers.', code: 'SERVER_ERROR' },
      { status: 500, headers: rateResult.headers }
    );
  }

  const employerIds = (onboardingRows ?? []).map((row) => row.id);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [employeesResult, advancesResult] = await Promise.all([
    employerIds.length
      ? adminSupabase
          .from('employees')
          .select('employer_id, monthly_salary, status')
          .in('employer_id', employerIds)
      : Promise.resolve({ data: [] as Array<{ employer_id: string; monthly_salary: number | null; status: string | null }> }),
    employerIds.length
      ? adminSupabase
          .from('advances')
          .select('employer_id, amount, created_at')
          .in('employer_id', employerIds)
          .gte('created_at', startOfMonth)
      : Promise.resolve({ data: [] as Array<{ employer_id: string; amount: number | null; created_at: string }> }),
  ]);

  const employeesByEmployer = new Map<string, { count: number; payroll: number }>();
  (employeesResult.data ?? []).forEach((employee) => {
    const curr = employeesByEmployer.get(employee.employer_id) ?? { count: 0, payroll: 0 };
    const active = employee.status === 'active';
    employeesByEmployer.set(employee.employer_id, {
      count: curr.count + (active ? 1 : 0),
      payroll: curr.payroll + (active ? employee.monthly_salary ?? 0 : 0),
    });
  });

  const advancesByEmployer = new Map<string, number>();
  (advancesResult.data ?? []).forEach((advance) => {
    advancesByEmployer.set(
      advance.employer_id,
      (advancesByEmployer.get(advance.employer_id) ?? 0) + (advance.amount ?? 0)
    );
  });

  const result = (onboardingRows ?? []).map((row) => {
    const employeeMeta = employeesByEmployer.get(row.id) ?? { count: 0, payroll: 0 };
    return {
      id: row.id,
      company_name: row.company_name ?? 'Unknown company',
      employer_code: row.company_code ?? `EMP-${row.id.slice(0, 8).toUpperCase()}`,
      industry: row.industry ?? '',
      country: row.country ?? '',
      registration_number: row.registration_number ?? null,
      tax_id: row.tax_id ?? null,
      address: row.physical_address ?? null,
      contact_person: row.contact_person ?? null,
      contact_email: row.contact_email ?? '',
      contact_phone: row.contact_phone ?? null,
      payroll_cycle: row.payroll_cycle ?? null,
      status: toAdminStatus(row.status),
      risk_score: row.risk_score ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at ?? row.created_at,
      employee_count: employeeMeta.count,
      total_advances: advancesByEmployer.get(row.id) ?? 0,
      monthly_payroll: employeeMeta.payroll,
    };
  });
  const stats = {
    total: result.length,
    active: result.filter((e) => e.status === 'approved').length,
    pending: result.filter((e) => e.status === 'pending').length,
    total_employees: result.reduce((sum, e) => sum + e.employee_count, 0),
  };

  const countries = [...new Set(result.map((e) => e.country).filter(Boolean))].sort();

  const filtered = result.filter((e) => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (countryFilter && e.country !== countryFilter) return false;
    if (searchFilter) {
      return (
        e.company_name.toLowerCase().includes(searchFilter) ||
        e.contact_email.toLowerCase().includes(searchFilter) ||
        e.employer_code.toLowerCase().includes(searchFilter) ||
        (e.contact_person ?? '').toLowerCase().includes(searchFilter)
      );
    }
    return true;
  });

  return NextResponse.json(
    {
      data: filtered,
      stats,
      countries,
    },
    { status: 200, headers: rateResult.headers }
  );
}
