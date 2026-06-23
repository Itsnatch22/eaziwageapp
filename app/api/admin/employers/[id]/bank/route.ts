import { NextRequest, NextResponse } from 'next/server';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/server/admin-auth';

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
  const { adminSupabase } = auth;

  const body = await req.json();
  const { bank_name, bank_account_number, reason } = body as {
    bank_name: string;
    bank_account_number: string;
    reason?: string;
  };

  if (!bank_name || !bank_account_number) {
    return NextResponse.json({ error: 'Bank name and account number are required' }, { status: 400 });
  }

  const { data: employer, error: fetchError } = await adminSupabase
    .from('employer_onboarding')
    .select('user_id')
    .eq('id', id)
    .single();

  if (fetchError || !employer) {
    return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
  }

  const updateData = {
    bank_name,
    bank_account_number,
    updated_at: new Date().toISOString(),
  };

  const { error: onboardingError } = await adminSupabase
    .from('employer_onboarding')
    .update(updateData)
    .eq('id', id);

  if (onboardingError) {
    return NextResponse.json({ error: 'Failed to update onboarding record' }, { status: 500 });
  }

  await adminSupabase
    .from('employers')
    .update(updateData)
    .eq('onboarding_id', id);

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

  return NextResponse.json({ message: 'Bank details updated successfully' });
}
