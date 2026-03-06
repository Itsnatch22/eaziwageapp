import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { isAdminRole, UserRoleEnum } from '@/lib/validations/kyc-validation';
import { createRouteHandlerClient } from '@/utils/supabase/server';

function generateCompanyCode(sourceId: string): string {
  return `EW-${sourceId.slice(0, 8).toUpperCase()}`;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-employer-status:${ip}`);

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

  // Verify Admin Role
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const roleCandidates = [profile?.role, user.app_metadata?.role, user.user_metadata?.role]
    .filter((r): r is string => typeof r === 'string' && r.length > 0)
    .map((r) => r.toLowerCase());

  if (!roleCandidates.some((r) => {
    const parsed = UserRoleEnum.safeParse(r);
    return parsed.success && isAdminRole(parsed.data);
  })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { status, employer_code, initial_credit_limit, reason } = body as {
    status: string;
    employer_code?: string;
    initial_credit_limit?: number;
    reason?: string;
  };

  if (!['approved', 'pending', 'rejected', 'suspended', 'risk_review_in_progress'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { data: employer, error: employerFetchError } = await adminSupabase
    .from('employer_onboarding')
    .select('id,user_id,company_name,max_advance_amount')
    .eq('id', id)
    .maybeSingle();

  if (employerFetchError || !employer) {
    return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
  }

  const updatePayload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (typeof initial_credit_limit === 'number' && Number.isFinite(initial_credit_limit) && initial_credit_limit > 0) {
    updatePayload.max_advance_amount = Math.round(initial_credit_limit);
  } else if (status === 'approved' && (!employer.max_advance_amount || Number(employer.max_advance_amount) <= 0)) {
    updatePayload.max_advance_amount = 500000;
  }

  const { error: updateError } = await adminSupabase
    .from('employer_onboarding')
    .update(updatePayload)
    .eq('id', id);

  if (updateError) {
    console.error('[PATCH employer status] Error:', updateError);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  // Activation workflow: ensure company code is present in profiles
  let resolvedCompanyCode: string | null = null;
  if (status === 'approved') {
    const { data: profileRow } = await adminSupabase
      .from('profiles')
      .select('company_code')
      .eq('id', employer.user_id)
      .maybeSingle();

    resolvedCompanyCode =
      (typeof employer_code === 'string' && employer_code.trim()) ||
      (profileRow?.company_code ? String(profileRow.company_code).trim() : '') ||
      generateCompanyCode(employer.id);

    await adminSupabase
      .from('profiles')
      .update({ company_code: resolvedCompanyCode })
      .eq('id', employer.user_id);

    // ─── Sync with primary 'employers' table ──────────────────────────────
    await adminSupabase.from('employers').upsert({
      id: employer.id,
      user_id: employer.user_id,
      company_name: employer.company_name,
      employer_code: resolvedCompanyCode,
      status: 'approved',
      max_advance_amount: updatePayload.max_advance_amount ?? employer.max_advance_amount ?? 500000,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  }

  // Notify employer about status change
  await adminSupabase.from('notifications').insert({
    user_id: employer.user_id,
    type: 'system',
    title: `Employer Status Updated: ${status.replace(/_/g, ' ')}`,
    message:
      status === 'approved'
        ? `Your employer profile is now fully active.${resolvedCompanyCode ? ` Company code: ${resolvedCompanyCode}.` : ''}`
        : `Your employer profile status changed to ${status.replace(/_/g, ' ')}.${reason ? ` Reason: ${reason}` : ''}`,
    read: false,
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({
    message: `Employer status updated to ${status}`,
    data: {
      status,
      company_code: resolvedCompanyCode,
      initial_credit_limit: updatePayload.max_advance_amount ?? employer.max_advance_amount ?? null,
    },
  });
}
