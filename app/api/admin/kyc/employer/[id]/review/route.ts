import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { isAdminRole, UserRoleEnum } from '@/lib/validations/kyc-validation';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { notifyEmployer } from '@/lib/notifications';
import { activateUser, deactivateUser } from '@/lib/activation';

function generateCompanyCode(sourceId: string): string {
  return `EW-${sourceId.slice(0, 8).toUpperCase()}`;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: appId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const notes = searchParams.get('notes') || '';

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-employer-kyc-review:${ip}`);

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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = getEnv();
  const adminSupabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !isAdminRole(UserRoleEnum.parse(profile.role.toLowerCase()))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!['approved', 'rejected'].includes(status || '')) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { data: reviewedEmployer, error: updateError } = await adminSupabase
    .from('employer_onboarding')
    .update({ 
      status, 
      reviewer_notes: notes,
      updated_at: new Date().toISOString()
    })
    .select('id,user_id,company_name,max_advance_amount')
    .eq('id', appId);

  if (updateError || !reviewedEmployer || reviewedEmployer.length === 0) {
    console.error('[Employer KYC Review] Update error:', updateError);
    return NextResponse.json({ error: 'Failed to update employer' }, { status: 500 });
  }

  const employer = reviewedEmployer[0];

  if (status === 'approved') {
    const { data: profileRow } = await adminSupabase
      .from('profiles')
      .select('company_code')
      .eq('id', employer.user_id)
      .maybeSingle();

    const resolvedCompanyCode =
      (profileRow?.company_code && String(profileRow.company_code).trim()) || generateCompanyCode(employer.id);

    await adminSupabase
      .from('profiles')
      .update({ company_code: resolvedCompanyCode })
      .eq('id', employer.user_id);

    if (!employer.max_advance_amount || Number(employer.max_advance_amount) <= 0) {
      await adminSupabase
        .from('employer_onboarding')
        .update({
          max_advance_amount: 500000,
          updated_at: new Date().toISOString(),
        })
        .eq('id', employer.id);
    }
    await activateUser(employer.user_id);
  } else {
    await deactivateUser(employer.user_id);
  }

  await notifyEmployer({
    userId: employer.user_id,
    type: 'kyc_update',
    title: status === 'approved' ? 'Employer Onboarding Approved' : 'Employer Onboarding Rejected',
    message:
      status === 'approved'
        ? `${employer.company_name} has been activated. You can now proceed with full platform setup.`
        : `Your onboarding submission was rejected.${notes ? ` Reason: ${notes}` : ''}`,
  });

  try {
  } catch (pusherErr) {
    console.error('[Employer KYC Review] Pusher trigger error:', pusherErr);
  }

  return NextResponse.json({
    message: 'Employer review submitted successfully',
    data: {
      employer_id: employer.id,
      status,
    },
  });
}
