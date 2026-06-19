import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import { createRouteHandlerClient } from '@/utils/supabase/server';

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

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401, headers: rateResult.headers }
    );
  }

  const env = getEnv();
  const adminSupabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const adminAccess = await checkAdminAccess({ user, adminSupabase });
  if (adminAccess.error) {
    return NextResponse.json({ error: 'Failed to verify role.' }, { status: 500 });
  }

  if (!adminAccess.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { bank_name, bank_account_number, reason } = body as {
    bank_name: string;
    bank_account_number: string;
    reason?: string;
  };

  if (!bank_name || !bank_account_number) {
    return NextResponse.json({ error: 'Bank name and account number are required' }, { status: 400 });
  }

  // Fetch employer to get user_id for notification
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

  // Update onboarding
  const { error: onboardingError } = await adminSupabase
    .from('employer_onboarding')
    .update(updateData)
    .eq('id', id);

  if (onboardingError) {
    return NextResponse.json({ error: 'Failed to update onboarding record' }, { status: 500 });
  }

  // Update live employer record
  await adminSupabase
    .from('employers')
    .update(updateData)
    .eq('onboarding_id', id);

  // Send notification to employer
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
