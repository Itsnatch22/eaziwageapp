import { redirect } from 'next/navigation';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import { getEnv } from '@/env';
import PaydayRecoupmentsClient, { type PaydayRecoupment } from './PaydayRecoupmentsClient';

export default async function AdminPaydayRecoupmentsPage() {
  const supabase = await createRouteHandlerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const access = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
  if (!access.isAdmin) redirect('/');

  const { data: rows } = await supabaseAdmin
    .from('payday_recoupments')
    .select('id, employer_id, payday_date, amount_due, currency, status, failure_reason, merchant_reference, created_at, updated_at')
    .eq('status', 'failed')
    .order('payday_date', { ascending: true });

  const { PII_ENCRYPTION_KEY } = getEnv();

  const recoupments: PaydayRecoupment[] = await Promise.all((rows ?? []).map(async (r) => {
    const { data: employer } = await supabaseAdmin
      .from('employers')
      .select('company_name, onboarding_id, bank_name')
      .eq('id', r.employer_id)
      .maybeSingle();

    let bankAccountNumber: string | null = null;
    if (employer?.onboarding_id && PII_ENCRYPTION_KEY) {
      const { data: dec } = await supabaseAdmin.rpc('admin_get_employer_bank_account', {
        p_onboarding_id: employer.onboarding_id,
        p_key: PII_ENCRYPTION_KEY,
      });
      bankAccountNumber = dec ?? null;
    }

    return {
      id:                   r.id,
      employer_id:          r.employer_id,
      payday_date:          r.payday_date,
      amount_due:           Number(r.amount_due ?? 0),
      currency:             r.currency ?? 'KES',
      status:               r.status as PaydayRecoupment['status'],
      failure_reason:       r.failure_reason,
      merchant_reference:   r.merchant_reference,
      created_at:           r.created_at,
      updated_at:           r.updated_at,
      company_name:         employer?.company_name ?? 'Unknown',
      bank_name:            employer?.bank_name ?? null,
      bank_account_number:  bankAccountNumber,
    };
  }));

  return <PaydayRecoupmentsClient recoupments={recoupments} />;
}
