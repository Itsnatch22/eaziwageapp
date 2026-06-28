import { redirect } from 'next/navigation';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import { getCurrencyFromCountry } from '@/lib/utils';
import AdvancesClient, { type Advance } from './AdvancesClient';

export default async function AdminAdvancesPage() {
  const supabase = await createRouteHandlerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const access = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
  if (!access.isAdmin) redirect('/');

  const { data: rows } = await supabaseAdmin
    .from('advances')
    .select(`
      id, amount, fee_amount, fee_percentage, net_amount,
      disbursement_method, status, created_at,
      employees!advances_employee_id_fkey(full_name, employee_code, country),
      employers!advances_employer_id_fkey(company_name)
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  const initialAdvances: Advance[] = (rows ?? []).map((a) => {
    const emp = Array.isArray(a.employees) ? a.employees[0] : a.employees;
    const org = Array.isArray(a.employers) ? a.employers[0] : a.employers;
    return {
      id:                  a.id,
      amount:              Number(a.amount ?? 0),
      fee_amount:          Number(a.fee_amount ?? 0),
      net_amount:          Number(a.net_amount ?? 0),
      fee_percentage:      a.fee_percentage != null ? Number(a.fee_percentage) : undefined,
      disbursement_method: a.disbursement_method ?? undefined,
      status:              (a.status ?? 'pending') as Advance['status'],
      created_at:          a.created_at,
      currency:            getCurrencyFromCountry(emp?.country, 'KES'),
      employee_name:       emp?.full_name || emp?.employee_code || 'Employee',
      employer_name:       org?.company_name || 'Unknown',
    };
  });

  return <AdvancesClient initialAdvances={initialAdvances} />;
}
