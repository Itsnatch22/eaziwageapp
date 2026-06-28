import { redirect } from 'next/navigation';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import EmployeesClient, { type Employee, type EmployeeStats } from './EmployeesClient';

function normalizeStatus(status: string | null | undefined): Employee['status'] {
  if (status === 'Active' || status === 'approved') return 'active';
  const s = status?.toLowerCase() ?? 'pending';
  if (s === 'active' || s === 'approved' || s === 'pending' || s === 'rejected' || s === 'suspended') return s as Employee['status'];
  return 'pending';
}

export default async function AdminEmployeesPage() {
  const supabase = await createRouteHandlerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const access = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
  if (!access.isAdmin) redirect('/');

  // Try live employees table first (post-KYC path); fall back to onboarding
  const { data: liveRows } = await supabaseAdmin
    .from('employees')
    .select('id, user_id, employer_id, employee_code, full_name, email, phone, country, job_title, department, monthly_salary, advance_limit, earned_wages, employment_type, hire_date, status, kyc_status, risk_score, currency, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(50);

  let initialEmployees: Employee[];
  let initialStats: EmployeeStats;

  if (liveRows && liveRows.length > 0) {
    initialEmployees = liveRows.map((emp) => ({
      id:               emp.id,
      user_id:          emp.user_id,
      employer_id:      emp.employer_id,
      employee_code:    emp.employee_code || 'N/A',
      full_name:        emp.full_name || 'Anonymous User',
      email:            emp.email,
      phone:            emp.phone,
      national_id:      null,
      country:          emp.country ?? null,
      job_title:        emp.job_title || 'Not Set',
      department:       emp.department || 'Not Set',
      monthly_salary:   emp.monthly_salary || 0,
      advance_limit:    emp.advance_limit || 0,
      earned_wages:     emp.earned_wages || 0,
      employment_type:  (emp.employment_type || 'full-time') as Employee['employment_type'],
      hire_date:        emp.hire_date ?? null,
      termination_date: null,
      status:           normalizeStatus(emp.status),
      kyc_status:       (emp.kyc_status || 'pending') as Employee['kyc_status'],
      risk_score:       emp.risk_score ?? null,
      currency:         emp.currency || 'KES',
      created_at:       emp.created_at,
      updated_at:       emp.updated_at,
    }));
    initialStats = {
      total:       liveRows.length,
      active:      liveRows.filter((e) => normalizeStatus(e.status) === 'active').length,
      pending_kyc: 0,
      suspended:   liveRows.filter((e) => normalizeStatus(e.status) === 'suspended').length,
    };
  } else {
    const { data: onboardingRows } = await supabaseAdmin
      .from('employee_onboarding')
      .select('id, user_id, employer_id, employee_code, full_name, full_name_placeholder, email, email_placeholder, job_title, department, employment_type, monthly_salary, country, status, created_at')
      .not('submitted_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    const rows = onboardingRows ?? [];
    initialEmployees = rows.map((emp) => ({
      id:               emp.id,
      user_id:          emp.user_id,
      employer_id:      emp.employer_id,
      employee_code:    emp.employee_code || 'N/A',
      full_name:        emp.full_name || emp.full_name_placeholder || 'Anonymous User',
      email:            emp.email || emp.email_placeholder || null,
      phone:            null,
      national_id:      null,
      country:          emp.country ?? null,
      job_title:        emp.job_title || 'Not Set',
      department:       emp.department || 'Not Set',
      monthly_salary:   Number(emp.monthly_salary ?? 0),
      advance_limit:    0,
      earned_wages:     0,
      employment_type:  (emp.employment_type || 'full-time') as Employee['employment_type'],
      hire_date:        null,
      termination_date: null,
      status:           normalizeStatus(emp.status),
      kyc_status:       (emp.status || 'pending') as Employee['kyc_status'],
      risk_score:       null,
      currency:         'KES',
      created_at:       emp.created_at,
      updated_at:       emp.created_at,
    }));
    initialStats = {
      total:       rows.length,
      active:      rows.filter((e) => normalizeStatus(e.status) === 'active').length,
      pending_kyc: 0,
      suspended:   rows.filter((e) => normalizeStatus(e.status) === 'suspended').length,
    };
  }

  return <EmployeesClient initialEmployees={initialEmployees} initialStats={initialStats} />;
}
