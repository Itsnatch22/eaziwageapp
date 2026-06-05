import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const supabase = await createClient();

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

  // Collect all possible employer IDs — employees may have registered under
  // employer_onboarding.id OR employers.id depending on which table existed at signup time.
  const employerIds: string[] = [];
  if (employer?.onboarding_id) employerIds.push(employer.onboarding_id);
  if (employer?.id && !employerIds.includes(employer.id)) {
    employerIds.push(employer.id);
  }

  if (employerIds.length === 0) {
    return NextResponse.json({ employees: [], stats: buildStats([]) });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter     = searchParams.get('status') ?? '';
  const departmentFilter = searchParams.get('department') ?? '';
  const countryFilter    = searchParams.get('country') ?? '';
  const searchTerm       = searchParams.get('search') ?? '';
  const fromDate         = searchParams.get('from') ?? '';
  const toDate           = searchParams.get('to') ?? '';

  let query = supabase
    .from('employee_onboarding')
    .select(`
      id,
      user_id,
      employee_code,
      full_name,
      full_name_placeholder,
      email,
      email_placeholder,
      national_id,
      id_type,
      date_of_birth,
      job_title,
      department,
      employment_type,
      start_date,
      monthly_salary,
      country,
      city,
      status,
      kyc_status:status,
      submitted_at,
      created_at,
      ewa_settings:employee_ewa_settings (
        ewa_enabled,
        max_advance_percentage,
        min_advance_amount,
        max_advance_amount,
        cooldown_period
      )
    `)
    .in('employer_id', employerIds)
    .order('created_at', { ascending: false });

  if (fromDate) query = query.gte('submitted_at', fromDate);
  if (toDate)   query = query.lte('submitted_at', toDate + 'T23:59:59Z');

  const { data: rawEmployees, error: empError } = await query;

  if (empError) {
    console.error('[employees/list]', empError);
    return NextResponse.json({ error: empError.message }, { status: 500 });
  }

  const userIds = (rawEmployees ?? []).map((e) => e.user_id).filter(Boolean);
  let profilesMap: Record<string, { full_name: string }> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    if (profiles) {
      profilesMap = profiles.reduce((acc, p) => {
        if (p.id) acc[p.id.toLowerCase()] = { full_name: p.full_name || 'Anonymous' };
        return acc;
      }, {} as Record<string, { full_name: string }>);
    }
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const allEmployees = (rawEmployees ?? []).map((e) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record = e as any;
    const lookupId = record.user_id?.toLowerCase() || '';
    const full_name: string =
      profilesMap[lookupId]?.full_name ??
      record.full_name ??
      record.full_name_placeholder ??
      ('Employee ' + (record.employee_code || ''));

    const startDate = record.start_date ? new Date(record.start_date) : null;
    const tenure_months = startDate
      ? Math.max(
          0,
          Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)),
        )
      : 0;

    const ewa = Array.isArray(record.ewa_settings) ? record.ewa_settings[0] : record.ewa_settings;

    return {
      id: record.id,
      user_id: record.user_id,
      employee_code: record.employee_code,
      full_name,
      email: record.email ?? record.email_placeholder ?? null,
      national_id: record.national_id,
      job_title: record.job_title,
      department: record.department,
      employment_type: record.employment_type,
      start_date: record.start_date,
      monthly_salary: Number(record.monthly_salary ?? 0),
      country: record.country,
      city: record.city,
      kyc_status: record.status,
      status: record.status === 'approved' ? 'approved' : record.status === 'rejected' ? 'rejected' : 'pending',
      tenure_months,
      submitted_at: record.submitted_at,
      created_at: record.created_at,
      ewa_settings: ewa
        ? {
            ewa_enabled: ewa.ewa_enabled,
            max_advance_percentage: ewa.max_advance_percentage,
            min_advance_amount: Number(ewa.min_advance_amount),
            max_advance_amount: Number(ewa.max_advance_amount),
            cooldown_period: ewa.cooldown_period,
          }
        : null,
    };
  });

  const stats = buildStats(allEmployees, thirtyDaysAgo);

  const filtered = allEmployees.filter((e: { status: string; department: string; country: string; full_name: string; employee_code: string; job_title: string; }) => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (departmentFilter && e.department !== departmentFilter) return false;
    if (countryFilter && e.country !== countryFilter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      if (
        !e.full_name?.toLowerCase().includes(s) &&
        !e.employee_code?.toLowerCase().includes(s) &&
        !e.job_title?.toLowerCase().includes(s) &&
        !e.department?.toLowerCase().includes(s)
      ) {
        return false;
      }
    }
    return true;
  });

  return NextResponse.json({ employees: filtered, stats });
}

interface Employee {
  id: string;
  user_id: string;
  employee_code: string;
  full_name: string;
  national_id: string;
  job_title: string;
  department: string;
  employment_type: string;
  start_date: string | null;
  monthly_salary: number;
  country: string;
  city: string;
  kyc_status: string;
  status: string;
  tenure_months: number;
  submitted_at: string;
  created_at: string;
  ewa_settings: {
    ewa_enabled: boolean;
    max_advance_percentage: number;
    min_advance_amount: number;
    max_advance_amount: number;
    cooldown_period: string;
  } | null;
}

function buildStats(
  employees: Employee[],
  thirtyDaysAgo?: Date,
) {
  const total = employees.length;
  const active = employees.filter((e) => e.status === 'approved').length;
  const kycApproved = employees.filter((e) => e.kyc_status === 'approved').length;
  const kyc_completion_rate = total > 0 ? Math.round((kycApproved / total) * 100) : 0;

  const longTenure = employees.filter((e) => (e.tenure_months ?? 0) >= 12).length;
  const retention_rate = total > 0 ? Math.round((longTenure / total) * 100) : 0;

  const tenures = employees.map((e) => e.tenure_months ?? 0);
  const avg_tenure_months =
    tenures.length > 0
      ? Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length)
      : 0;

  const new_hires_30_days = thirtyDaysAgo
    ? employees.filter((e) => e.created_at && new Date(e.created_at) >= thirtyDaysAgo).length
    : 0;

  const department_breakdown: Record<string, number> = {};
  for (const e of employees) {
    const dept = e.department || 'General';
    department_breakdown[dept] = (department_breakdown[dept] ?? 0) + 1;
  }

  return {
    total_employees: total,
    active_employees: active,
    kyc_completion_rate,
    retention_rate,
    avg_tenure_months,
    new_hires_30_days,
    department_breakdown,
  };
}
