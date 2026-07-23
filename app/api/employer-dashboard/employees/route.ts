import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { dbErrorResponse } from '@/lib/api-errors';

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
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (employerError) {
    return dbErrorResponse('employer-dashboard/employees', employerError);
  }

  if (!employer?.id) {
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
    .from('employees')
    .select(`
      id,
      user_id,
      employee_code,
      full_name,
      email,
      phone,
      employee_number,
      job_title,
      department,
      employment_type,
      hire_date,
      monthly_salary,
      status,
      kyc_status,
      created_at,
      ewa_settings:employee_ewa_settings (
        ewa_enabled,
        max_advance_percentage,
        min_advance_amount,
        max_advance_amount,
        cooldown_period
      )
    `)
    .eq('employer_id', employer.id)
    .order('created_at', { ascending: false });

  if (fromDate) query = query.gte('created_at', fromDate);
  if (toDate)   query = query.lte('created_at', toDate + 'T23:59:59Z');

  const { data: rawEmployees, error: empError } = await query;

  if (empError) {
    return dbErrorResponse('employer-dashboard/employees', empError);
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
    const lookupId = e.user_id?.toLowerCase() ?? '';
    const full_name: string =
      profilesMap[lookupId]?.full_name ??
      e.full_name ??
      ('Employee ' + (e.employee_code ?? ''));

    const startDate = e.hire_date ? new Date(e.hire_date) : null;
    const tenure_months = startDate
      ? Math.max(
          0,
          Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)),
        )
      : 0;

    const ewaRaw = e.ewa_settings;
    const ewa = Array.isArray(ewaRaw) ? ewaRaw[0] : ewaRaw;

    return {
      id: e.id ?? '',
      user_id: e.user_id ?? '',
      employee_code: e.employee_code ?? '',
      full_name,
      email: e.email ?? null,
      national_id: '',
      job_title: e.job_title ?? '',
      department: e.department ?? '',
      employment_type: e.employment_type ?? '',
      start_date: e.hire_date ?? null,
      monthly_salary: Number(e.monthly_salary ?? 0),
      country: '',
      city: '',
      kyc_status: e.kyc_status ?? 'approved',
      status: e.status === 'Active' || e.status === 'approved' ? 'approved' : e.status === 'Terminated' || e.status === 'rejected' ? 'rejected' : 'pending',
      tenure_months,
      submitted_at: e.created_at ?? '',
      created_at: e.created_at ?? '',
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
