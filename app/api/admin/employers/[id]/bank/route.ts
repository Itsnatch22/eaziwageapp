import { NextRequest, NextResponse } from 'next/server';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/server/admin-auth';
import { EmployerBankPatchSchema } from '@/lib/validations/route-schemas';
import { getEnv } from '@/env';

export async function PATCH(
  req: NextRequest,
  { params }: IdRouteContext
): Promise<NextResponse> {
  const { id } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-employer-bank:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers }
    );
  }

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { adminSupabase, user } = auth;

  const raw = await req.json().catch(() => null);
  const bankParsed = EmployerBankPatchSchema.safeParse(raw);
  if (!bankParsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: bankParsed.error.issues },
      { status: 422 },
    );
  }
  const { bank_name, bank_account_number, reason } = bankParsed.data;

  const { data: employer, error: fetchError } = await adminSupabase
    .from('employer_onboarding')
    .select('user_id')
    .eq('id', id)
    .single();

  if (fetchError || !employer) {
    return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
  }

  const { PII_ENCRYPTION_KEY } = getEnv();
  if (!PII_ENCRYPTION_KEY) {
    return NextResponse.json({ error: 'Encryption not configured' }, { status: 500 });
  }

  const { error: encryptError } = await adminSupabase.rpc('admin_update_employer_bank_account', {
    p_onboarding_id: id,
    p_bank_name: bank_name,
    p_account_number: bank_account_number,
    p_key: PII_ENCRYPTION_KEY,
  });

  if (encryptError) {
    console.error('[admin/employers/:id/bank] Failed to update bank account:', encryptError);
    return NextResponse.json({ error: 'Failed to update bank details' }, { status: 500 });
  }

  await adminSupabase.from('notifications').insert({
    user_id: employer.user_id,
    type: 'system',
    title: 'Bank Details Updated',
    message: reason 
      ? `Your bank details have been updated by admin. Reason: ${reason}`
      : 'Your bank details have been updated by admin.',
    read: false,
    created_at: new Date().toISOString(),
  });

  const maskedAccountNumber = bank_account_number.length > 4
    ? `•••• ${bank_account_number.slice(-4)}`
    : '••••••••';

  void adminSupabase.from('system_audit_logs').insert({
    admin_id: user.id,
    admin_name: user.email,
    target_id: id,
    target_type: 'employer',
    action: 'employer_bank_updated',
    old_value: null,
    new_value: { bank_name, bank_account_number: maskedAccountNumber },
    metadata: { reason },
  }).then(({ error }) => { if (error) console.error('[audit] employer_bank_updated:', error); });

  return NextResponse.json({ message: 'Bank details updated successfully' });
}
