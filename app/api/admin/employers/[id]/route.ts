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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-employer-detail:${ip}`);
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

  const { data: employer, error } = await adminSupabase
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
    .eq('id', id)
    .single();

  if (error || !employer) {
    return NextResponse.json(
      { error: 'Employer not found.', code: 'NOT_FOUND' },
      { status: 404, headers: rateResult.headers }
    );
  }

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [employeeResult, advancesResult] = await Promise.all([
    adminSupabase
      .from('employees')
      .select('monthly_salary,status')
      .eq('employer_id', id),
    adminSupabase
      .from('advances')
      .select('amount')
      .eq('employer_id', id)
      .gte('created_at', startOfMonth),
  ]);

  const activeEmployees = (employeeResult.data ?? []).filter((e) => e.status === 'active');
  const employeeCount = activeEmployees.length;
  const monthlyPayroll = activeEmployees.reduce((sum, e) => sum + (e.monthly_salary ?? 0), 0);
  const totalAdvances = (advancesResult.data ?? []).reduce((sum, a) => sum + (a.amount ?? 0), 0);

  return NextResponse.json(
    {
      id: employer.id,
      company_name: employer.company_name ?? 'Unknown company',
      employer_code: employer.company_code ?? `EMP-${employer.id.slice(0, 8).toUpperCase()}`,
      industry: employer.industry ?? '',
      country: employer.country ?? '',
      registration_number: employer.registration_number ?? null,
      tax_id: employer.tax_id ?? null,
      address: employer.physical_address ?? null,
      contact_person: employer.contact_person ?? null,
      contact_email: employer.contact_email ?? '',
      contact_phone: employer.contact_phone ?? null,
      payroll_cycle: employer.payroll_cycle ?? null,
      status: toAdminStatus(employer.status),
      risk_score: employer.risk_score ?? null,
      created_at: employer.created_at,
      updated_at: employer.updated_at ?? employer.created_at,
      employee_count: employeeCount,
      total_advances: totalAdvances,
      monthly_payroll: monthlyPayroll,
    },
    { status: 200, headers: rateResult.headers }
  );
}