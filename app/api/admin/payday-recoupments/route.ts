import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { getEnv } from '@/env';

export const runtime = 'nodejs';

// Recoupments that failed automated mobile money collection and need a manual
// bank-transfer fallback (see the confirm route, which sets 'failed' when
// DusuPay's collection call errors or the employer has no mobile money on file).
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { adminSupabase } = auth;

  const { data: recoupments, error } = await adminSupabase
    .from('payday_recoupments')
    .select('id, employer_id, payday_date, amount_due, currency, status, failure_reason, merchant_reference, created_at, updated_at')
    .eq('status', 'failed')
    .order('payday_date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { PII_ENCRYPTION_KEY } = getEnv();

  const enriched = await Promise.all((recoupments ?? []).map(async (r) => {
    const { data: employer } = await adminSupabase
      .from('employers')
      .select('company_name, onboarding_id, bank_name')
      .eq('id', r.employer_id)
      .maybeSingle();

    let bankAccountNumber: string | null = null;
    if (employer?.onboarding_id && PII_ENCRYPTION_KEY) {
      const { data: dec } = await adminSupabase.rpc('admin_get_employer_bank_account', {
        p_onboarding_id: employer.onboarding_id,
        p_key: PII_ENCRYPTION_KEY,
      });
      bankAccountNumber = dec ?? null;
    }

    return {
      ...r,
      company_name: employer?.company_name ?? 'Unknown',
      bank_name: employer?.bank_name ?? null,
      bank_account_number: bankAccountNumber,
    };
  }));

  return NextResponse.json({ recoupments: enriched });
}
