import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { checkAdminAccess } from '@/lib/server/admin-auth';
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

  const adminAccess = await checkAdminAccess({ user, adminSupabase });
  if (adminAccess.error) {
    return NextResponse.json({ error: 'Failed to verify role.', code: 'ROLE_CHECK_FAILED' }, { status: 500 });
  }
  if (!adminAccess.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle<{ full_name: string | null }>();

  const body = await req.json();
  const { status, employer_code, min_advance_amount, initial_credit_limit, reason } = body as {
    status: string;
    employer_code?: string;
    min_advance_amount?: number;
    initial_credit_limit?: number;
    reason?: string;
  };

  if (!['approved', 'pending', 'rejected', 'suspended', 'risk_review_in_progress'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  console.log(`[PATCH employer status] Attempting update for ID: ${id} to status: ${status}`);

  const { data: initialEmployer, error: employerFetchError } = await adminSupabase
    .from('employer_onboarding')
    .select('id,user_id,company_name,min_advance_amount,currency')
    .eq('id', id)
    .maybeSingle();
  let employer = initialEmployer;

  if (!employer && !employerFetchError) {
    console.log(`[PATCH employer status] ID ${id} not found in onboarding, checking primary 'employers' table...`);
    const { data: primaryEmp } = await adminSupabase
      .from('employers')
      .select('id,user_id,company_name,min_advance_amount')
      .eq('id', id)
      .maybeSingle();
    
    if (primaryEmp) {
      const { data: fallbackOnboarding } = await adminSupabase
        .from('employer_onboarding')
        .select('id,user_id,company_name,min_advance_amount,currency')
        .eq('user_id', primaryEmp.user_id)
        .maybeSingle();
      
      if (fallbackOnboarding) {
        console.log(`[PATCH employer status] Found onboarding record ${fallbackOnboarding.id} via user_id ${primaryEmp.user_id}`);
        employer = fallbackOnboarding;
      }
    }
  }

  if (employerFetchError || !employer) {
    console.error(`[PATCH employer status] Employer not found for ID: ${id}`, employerFetchError);
    return NextResponse.json({ 
      error: 'Employer record not found. The ID might be incorrect or the record was deleted.',
      debug_id: id 
    }, { status: 404 });
  }

  const activeId = employer.id;

  const updatePayload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  const resolvedMinAdvance =
    typeof min_advance_amount === 'number' && Number.isFinite(min_advance_amount)
      ? min_advance_amount
      : (typeof initial_credit_limit === 'number' && Number.isFinite(initial_credit_limit)
          ? initial_credit_limit
          : undefined);

  if (typeof resolvedMinAdvance === 'number' && resolvedMinAdvance > 0) {
    updatePayload.min_advance_amount = Math.round(resolvedMinAdvance);
  } else if (status === 'approved' && (!employer.min_advance_amount || Number(employer.min_advance_amount) <= 0)) {
    updatePayload.min_advance_amount = 500;
  }

  const { error: updateError } = await adminSupabase
    .from('employer_onboarding')
    .update(updatePayload)
    .eq('id', activeId);

  if (updateError) {
    console.error('[PATCH employer status] Error:', updateError);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  console.log(`[PATCH employer status] Successfully updated record ${activeId}`);

  // ── Sync to Primary 'employers' Table ──────────────────────────────────────
  let resolvedCompanyCode: string | null = null;
  const { data: existingEmployer } = await adminSupabase
    .from('employers')
    .select('id, employer_code')
    .eq('id', employer.id)
    .maybeSingle();

  if (status === 'approved' || existingEmployer) {
    const { data: profileRow } = await adminSupabase
      .from('profiles')
      .select('company_code')
      .eq('id', employer.user_id)
      .maybeSingle();

    resolvedCompanyCode =
      (typeof employer_code === 'string' && employer_code.trim()) ||
      existingEmployer?.employer_code ||
      (profileRow?.company_code ? String(profileRow.company_code).trim() : '') ||
      generateCompanyCode(employer.id);

    if (resolvedCompanyCode) {
      await adminSupabase
        .from('profiles')
        .update({ company_code: resolvedCompanyCode })
        .eq('id', employer.user_id);
    }

    const upsertPayload = {
      id: employer.id,
      user_id: employer.user_id,
      company_name: employer.company_name,
      employer_code: resolvedCompanyCode,
      status: status, // Sync the status (approved, suspended, etc.)
      min_advance_amount: updatePayload.min_advance_amount ?? employer.min_advance_amount ?? 500,
      currency: employer.currency,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await adminSupabase
      .from('employers')
      .upsert(upsertPayload, { onConflict: 'id' });

    if (upsertError) {
      console.error('[PATCH employer status] Upsert error:', upsertError);
      // We don't necessarily want to fail the whole request if the secondary sync fails,
      // but logging it is critical.
    }
  }

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

  await adminSupabase.from('system_audit_logs').insert({
    admin_id: user.id,
    admin_name: profile?.full_name || 'Admin',
    target_id: activeId,
    target_type: 'employer',
    action: 'account_status',
    new_status: status,
    reason: reason || null,
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({
    message: `Employer status updated to ${status}`,
    data: {
      status,
      company_code: resolvedCompanyCode,
      min_advance_amount: updatePayload.min_advance_amount ?? employer.min_advance_amount ?? null,
    },
  });
}
