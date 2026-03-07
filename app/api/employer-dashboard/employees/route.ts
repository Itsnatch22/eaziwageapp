import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Resolve employer ──────────────────────────────────────────────────────
  const { data: onboardingEmp, error: employerError } = await supabase
    .from('employer_onboarding')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ['approved', 'submitted', 'pending', 'risk_review_in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (employerError) {
    return NextResponse.json({ error: employerError.message }, { status: 500 });
  }

  let employer = onboardingEmp;

  if (!employer) {
    // Check fallback in 'employers' table
    const { data: syncedEmp } = await supabase
      .from('employers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (!syncedEmp) {
      return NextResponse.json({ employees: [], stats: buildStats([]) });
    }
    employer = syncedEmp;
  }

  // ── Parse query params ────────────────────────────────────────────────────
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
    .eq('employer_id', employer.id)
    .order('created_at', { ascending: false });

  // Date range on submitted_at
  if (fromDate) query = query.gte('submitted_at', fromDate);
  if (toDate)   query = query.lte('submitted_at', toDate + 'T23:59:59Z');

  const { data: rawEmployees, error: empError } = await query;

  if (empError) {
    console.error('[employees/list]', empError);
    return NextResponse.json({ error: empError.message }, { status: 500 });
  }

  // ── Fetch profiles for all employees ──────────────────────────────────────
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

  // ── Shape each employee record ────────────────────────────────────────────
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const allEmployees = (rawEmployees ?? []).map((e) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record = e as any;
    // Pull full_name from profilesMap with normalized ID
    const lookupId = record.user_id?.toLowerCase() || '';
    const full_name: string = profilesMap[lookupId]?.full_name ?? ('Employee ' + (record.employee_code || ''));

    // Compute tenure in months from start_date
    const startDate = record.start_date ? new Date(record.start_date) : null;
    const tenure_months = startDate
      ? Math.max(
          0,
          Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)),
        )
      : 0;

    // EWA settings — Supabase returns array for one-to-one joins, flatten it
    const ewa = Array.isArray(record.ewa_settings) ? record.ewa_settings[0] : record.ewa_settings;

    return {
      id: record.id,
      user_id: record.user_id,
      employee_code: record.employee_code,
      full_name,
      national_id: record.national_id,
      job_title: record.job_title,
      department: record.department,
      employment_type: record.employment_type,
      start_date: record.start_date,
      monthly_salary: Number(record.monthly_salary ?? 0),
      country: record.country,
      city: record.city,
      // kyc_status = status on employee_onboarding
      kyc_status: record.status,
      // employee "status" from employer's perspective: approved once KYC is done
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

  // ── Compute extended stats over FULL (unfiltered) set ────────────────────
  const stats = buildStats(allEmployees, thirtyDaysAgo);

  // ── Apply client filters in-memory ───────────────────────────────────────
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

// ─── Stats builder ────────────────────────────────────────────────────────────
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

  // Retention: employees with 12+ months tenure
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

  // Department breakdown
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