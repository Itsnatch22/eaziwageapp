import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { isAdminRole, UserRoleEnum } from '@/lib/validations/kyc-validation';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { notifyEmployer } from '@/lib/notifications';
import { activateUser, deactivateUser } from '@/lib/activation';

// Must satisfy employers.company_code check: ^[A-Z0-9]{3,20}$
function generateCompanyCode(sourceId: string): string {
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

  const { data: adminProfile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!adminProfile || !isAdminRole(UserRoleEnum.parse(adminProfile.role.toLowerCase()))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!['approved', 'rejected'].includes(status || '')) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // Step 1 — Update employer_onboarding and return all fields needed for employers sync.
  const { data: reviewedRows, error: updateError } = await adminSupabase
    .from('employer_onboarding')
    .update({
      status,
      reviewer_notes: notes,
      updated_at: new Date().toISOString(),
    })
    .select(
      'id, user_id, company_name, company_code, industry, country, registration_number, tax_id, physical_address, contact_person, contact_email, contact_phone, payroll_cycle, risk_score, risk_rating, min_advance_amount, max_advance_amount, max_advance_percentage, cooldown_period'
    )
    .eq('id', appId);

  if (updateError || !reviewedRows || reviewedRows.length === 0) {
    console.error('[Employer KYC Review] Update error:', updateError);
    return NextResponse.json({ error: 'Failed to update employer' }, { status: 500 });
  }

  const employer = reviewedRows[0];

  if (status === 'approved') {
    // Fetch profile for email + existing company_code
    const { data: profileRow } = await adminSupabase
      .from('profiles')
      .select('email, phone, company_code')
      .eq('id', employer.user_id)
      .maybeSingle();

    // Check if an employers row already exists for this user
    const { data: existingEmployer } = await adminSupabase
      .from('employers')
      .select('id, company_code')
      .eq('user_id', employer.user_id)
      .maybeSingle();

    // Canonical company_code — must satisfy ^[A-Z0-9]{3,20}$
    // Priority: existing employers row → onboarding record → deterministic fallback
    const canonicalCode: string =
      existingEmployer?.company_code ??
      (employer.company_code ? String(employer.company_code).replace(/[^A-Z0-9]/gi, '').slice(0, 20).toUpperCase() : null) ??
      (profileRow?.company_code ? String(profileRow.company_code).replace(/[^A-Z0-9]/gi, '').slice(0, 20).toUpperCase() : null) ??
      generateCompanyCode(employer.id);

    // Stamp company_code on employer_onboarding if not already set
    if (!employer.company_code) {
      await adminSupabase
        .from('employer_onboarding')
        .update({ company_code: canonicalCode, updated_at: new Date().toISOString() })
        .eq('id', employer.id);
    }

    // Ensure min advance amount is set
    if (!employer.max_advance_amount || Number(employer.max_advance_amount) <= 0) {
      await adminSupabase
        .from('employer_onboarding')
        .update({ max_advance_amount: 500000, updated_at: new Date().toISOString() })
        .eq('id', employer.id);
    }

    const primaryStatus = toPrimaryEmployerStatus(status);

    const syncPayload = {
      user_id:             employer.user_id,
      company_name:        employer.company_name || 'Unknown company',
      company_code:        canonicalCode,
      employer_code:       canonicalCode,
      onboarding_id:       employer.id,
      email:               employer.contact_email || profileRow?.email || `${employer.user_id}@placeholder.eaziwage.com`,
      phone:               employer.contact_phone || profileRow?.phone || null,
      status:              primaryStatus,
      industry:            employer.industry || null,
      country:             employer.country || 'Kenya',
      registration_number: employer.registration_number || null,
      tax_id:              employer.tax_id || null,
      address:             employer.physical_address || null,
      contact_person:      employer.contact_person || null,
      contact_email:       employer.contact_email || null,
      contact_phone:       employer.contact_phone || null,
      payroll_cycle:       employer.payroll_cycle || null,
      risk_score:          employer.risk_score ?? 3.0,
      risk_rating:         employer.risk_rating || 'B',
      is_verified:         true,
      advance_limit_percent: Number(employer.max_advance_percentage ?? 50),
      cooldown_days:        Number(employer.cooldown_period ?? 7),
      min_advance_amount:   Number(employer.min_advance_amount ?? 500),
      updated_at:          new Date().toISOString(),
    };

    console.log(`[Employer KYC Review] employers sync: ${existingEmployer ? 'UPDATE' : 'INSERT'} for user ${employer.user_id}`);

    // Step 2 — Upsert employers row BEFORE touching profiles (avoids FK violation).
    const { error: syncError } = existingEmployer
      ? await adminSupabase.from('employers').update(syncPayload).eq('id', existingEmployer.id)
      : await adminSupabase.from('employers').insert({
          ...syncPayload,
          employer_id: employer.user_id,
          created_at: new Date().toISOString(),
        });

    if (syncError) {
      console.error('[Employer KYC Review] employers sync failed:', syncError);
      // Non-fatal — status was already updated; log and continue so the admin isn't blocked.
      // The employers row can be created via the status route once the error is resolved.
    } else {
      // Step 3 — profiles.company_code update is safe now: employers row is committed.
      const { error: profileCodeError } = await adminSupabase
        .from('profiles')
        .update({ company_code: canonicalCode })
        .eq('id', employer.user_id);

      if (profileCodeError) {
        console.error('[Employer KYC Review] profiles.company_code update failed:', profileCodeError.message);
      }
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

  return NextResponse.json({
    message: 'Employer review submitted successfully',
    data: {
      employer_id: employer.id,
      status,
    },
  });
}
