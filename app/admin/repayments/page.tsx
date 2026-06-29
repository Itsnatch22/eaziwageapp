import { redirect } from 'next/navigation';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import RepaymentsClient, { type RepaymentSchedule } from './RepaymentsClient';

export default async function AdminRepaymentsPage() {
  const supabase = await createRouteHandlerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const access = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
  if (!access.isAdmin) redirect('/');

  const { data: rows } = await supabaseAdmin
    .from('repayment_schedules')
    .select(`
      id, advance_id, employer_id, employee_id,
      repayment_amount, currency, due_date, payroll_cycle,
      repayment_reference, status, paid_amount, paid_at,
      payment_reference, overdue_notified_at, created_at,
      employers!employer_id ( company_name ),
      employees!employee_id ( full_name )
    `)
    .order('due_date', { ascending: false })
    .limit(200);

  const schedules: RepaymentSchedule[] = (rows ?? []).map((r) => {
    const employer = Array.isArray(r.employers) ? r.employers[0] : r.employers;
    const employee = Array.isArray(r.employees) ? r.employees[0] : r.employees;
    return {
      id:                  r.id,
      advance_id:          r.advance_id,
      employer_id:         r.employer_id,
      employee_id:         r.employee_id,
      repayment_amount:    Number(r.repayment_amount ?? 0),
      currency:            r.currency ?? 'KES',
      due_date:            r.due_date,
      payroll_cycle:       r.payroll_cycle ?? 'monthly',
      repayment_reference: r.repayment_reference,
      status:              (r.status ?? 'pending') as RepaymentSchedule['status'],
      paid_amount:         Number(r.paid_amount ?? 0),
      paid_at:             r.paid_at ?? null,
      payment_reference:   r.payment_reference ?? null,
      overdue_notified_at: r.overdue_notified_at ?? null,
      created_at:          r.created_at,
      employer_name:       (employer as { company_name?: string } | null)?.company_name ?? 'Unknown',
      employee_name:       (employee as { full_name?: string } | null)?.full_name ?? 'Employee',
    };
  });

  return <RepaymentsClient schedules={schedules} />;
}
