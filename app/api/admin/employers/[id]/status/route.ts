import { NextRequest, NextResponse } from 'next/server';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/server/admin-auth';

// Produces a code satisfying employers.company_code check: ^[A-Z0-9]{3,20}$
function generatePrimaryCompanyCode(sourceId: string): string {
  return sourceId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

function toPrimaryEmployerStatus(status: string): 'approved' | 'pending' | 'suspended' {
  if (status === 'approved' || status === 'suspended') return status;
  return 'pending';
}

export async function PATCH(
  req: NextRequest,
  { params }: IdRouteContext
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

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { user, adminSupabase } = auth;

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
    .select('id,user_id,company_name,industry,country,registration_number,tax_id,physical_address,contact_person,contact_email,contact_phone,payroll_cycle,risk_score,risk_rating,min_advance_amount,currency,max_advance_percentage,cooldown_period')
    .eq('id', id)
    .maybeSingle();
  let employer = initialEmployer;

  if (!employer && !employerFetchError) {
    console.log(`[PATCH employer status] ID ${id} not found in onboarding, checking primary 'employers' table...`);
    const { data: primaryEmp } = await adminSupabase
      .from('employers')
      .select('id,user_id,company_name')
      .eq('id', id)
      .maybeSingle();
    
    if (primaryEmp) {
      const { data: fallbackOnboarding } = await adminSupabase
        .from('employer_onboarding')
        .select('id,user_id,company_name,industry,country,registration_number,tax_id,physical_address,contact_person,contact_email,contact_phone,payroll_cycle,risk_score,risk_rating,min_advance_amount,currency,max_advance_percentage,cooldown_period')
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
    // Always stamp company_code on the onboarding record so it becomes the
    // canonical lookup source for employee registration.
    ...(!(employer as Record<string, unknown>).company_code && status !== 'rejected'
      ? { company_code: (typeof employer_code === 'string' && employer_code.trim()
          ? employer_code.trim().replace(/[^A-Z0-9]/gi, '').slice(0, 20).toUpperCase()
          : generatePrimaryCompanyCode(employer.id)) }
      : {}),
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

  let resolvedCompanyCode: string | null = null;
  const { data: existingEmployer } = await adminSupabase
    .from('employers')
    .select('id, company_code, employer_code')
    .eq('user_id', employer.user_id)
    .maybeSingle();

  // Run sync when approving OR when an employers row already exists (keeps it in sync on
  // every status change). Never creates an employers row for non-approved statuses.
  if (status === 'approved' || existingEmployer) {
    const { data: profileRow } = await adminSupabase
      .from('profiles')
      .select('email, phone')
      .eq('id', employer.user_id)
      .maybeSingle();

    // Canonical code — must satisfy employers.company_code check: ^[A-Z0-9]{3,20}$
    // Priority: admin-provided → employer_onboarding.company_code (stamped above) →
    //           existing employers row → deterministic fallback from onboarding UUID.
    const onboardingCode = (employer as Record<string, unknown>).company_code as string | null;
    const canonicalCode: string =
      (typeof employer_code === 'string' && employer_code.trim()
        ? employer_code.trim().replace(/[^A-Z0-9]/gi, '').slice(0, 20).toUpperCase()
        : null) ??
      onboardingCode ??
      existingEmployer?.company_code ??
      generatePrimaryCompanyCode(employer.id);

    const primaryStatus = toPrimaryEmployerStatus(status);

    const syncPayload = {
      user_id:             employer.user_id,
      company_name:        employer.company_name || 'Unknown company',
      // Bug 1 fix: single valid code used for both columns — no EW- prefix.
      company_code:        canonicalCode,
      employer_code:       canonicalCode,
      // Bug 2 fix: always carry onboarding_id so the public employers join works.
      onboarding_id:       activeId,
      email:               employer.contact_email || profileRow?.email || null,
      phone:               employer.contact_phone || profileRow?.phone || null,
      status:              primaryStatus,
      industry:            employer.industry || null,
      country:             employer.country || null,
      registration_number: employer.registration_number || null,
      tax_id:              employer.tax_id || null,
      address:             employer.physical_address || null,
      contact_person:      employer.contact_person || null,
      contact_email:       employer.contact_email || null,
      contact_phone:       employer.contact_phone || null,
      payroll_cycle:       employer.payroll_cycle || null,
      risk_score:          employer.risk_score ?? null,
      risk_rating:         employer.risk_rating || null,
      is_verified:         primaryStatus === 'approved',
      advance_limit_percent: (employer as { max_advance_percentage?: number | null }).max_advance_percentage ?? 50,
      cooldown_days:         (employer as { cooldown_period?: number | null }).cooldown_period ?? 7,
      min_advance_amount:    (updatePayload.min_advance_amount as number | undefined) ?? employer.min_advance_amount ?? 500,
      updated_at:          new Date().toISOString(),
    };

    // Bug 3 fix: commit employers row FIRST so the FK
    // (profiles.company_code → employers.company_code) is satisfied before we touch profiles.
    const { error: syncError } = existingEmployer
      ? await adminSupabase.from('employers').update(syncPayload).eq('id', existingEmployer.id)
      : await adminSupabase.from('employers').insert({
          ...syncPayload,
          employer_id: employer.user_id,
          created_at: new Date().toISOString(),
        });

    if (syncError) {
      console.error('[PATCH employer status] Primary employers sync error:', syncError);
      return NextResponse.json({ error: 'Employer status updated, but primary employer sync failed' }, { status: 500 });
    }

    // profiles.company_code update is safe now — employers row is committed.
    const { error: profileCodeError } = await adminSupabase
      .from('profiles')
      .update({ company_code: canonicalCode })
      .eq('id', employer.user_id);

    if (profileCodeError) {
      // Non-fatal: employees can still register; log for investigation.
      console.error('[PATCH employer status] profiles.company_code update failed:', profileCodeError.message);
    }

    resolvedCompanyCode = canonicalCode;
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
