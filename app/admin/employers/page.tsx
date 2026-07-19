import { redirect } from 'next/navigation';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import EmployersClient, { type Employer, type EmployerStats, type EmployersInitialData } from './EmployersClient';

function toAdminStatus(status: string | null | undefined): 'approved' | 'pending' | 'rejected' | 'suspended' {
  if (status === 'approved' || status === 'rejected' || status === 'suspended') return status;
  return 'pending';
}

export default async function AdminEmployersPage() {
  const supabase = await createRouteHandlerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const access = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
  if (!access.isAdmin) redirect('/');

  const { data: rows } = await supabaseAdmin
    .from('employer_onboarding')
    .select(
      'id, company_name, industry, country, registration_number, tax_id, physical_address, contact_person, contact_email, contact_phone, payroll_cycle, status, account_status, risk_score, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(25);

  const all = rows ?? [];

  // account_status is the admin's account-approval decision (dashboard
  // access) — the badge/stat this page has always shown. `status` is the
  // separate, pure KYC-document rollup.
  const stats: EmployerStats = {
    total:           all.length,
    active:          all.filter((e) => toAdminStatus(e.account_status) === 'approved').length,
    pending:         all.filter((e) => toAdminStatus(e.account_status) === 'pending').length,
    total_employees: 0,
  };

  const countries = [...new Set(all.map((e) => e.country).filter(Boolean))].sort() as string[];

  const employers: Employer[] = all.map((row) => ({
    id:                  row.id,
    company_name:        row.company_name ?? 'Unknown company',
    employer_code:       `EW-${row.id.slice(0, 8).toUpperCase()}`,
    industry:            row.industry ?? '',
    country:             row.country ?? '',
    registration_number: row.registration_number ?? null,
    tax_id:              row.tax_id ?? null,
    address:             row.physical_address ?? null,
    contact_person:      row.contact_person ?? null,
    contact_email:       row.contact_email ?? '',
    contact_phone:       row.contact_phone ?? null,
    payroll_cycle:       (row.payroll_cycle as Employer['payroll_cycle']) ?? null,
    status:              toAdminStatus(row.account_status),
    employee_count:      0,
    total_advances:      0,
    monthly_payroll:     0,
    risk_score:          row.risk_score != null ? Number(row.risk_score) : null,
    bank_name:           null,
    bank_account_number: null,
    deleted_at:          null,
    created_at:          row.created_at,
    updated_at:          row.updated_at ?? row.created_at,
  }));

  const initialData: EmployersInitialData = { employers, stats, countries };

  return <EmployersClient initialData={initialData} />;
}
