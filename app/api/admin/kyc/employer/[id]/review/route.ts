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

    // Resolve organization_id — required by advances.organization_id NOT NULL.
    // Look up by country_code first, then country name. Non-fatal if not found (logged).
    const COUNTRY_CODE_MAP: Record<string, string> = {
      'Kenya': 'KE', 'Uganda': 'UG', 'Tanzania': 'TZ', 'Rwanda': 'RW',
    };
    const employerCountryCode = COUNTRY_CODE_MAP[employer.country ?? ''] ?? null;
    let resolvedOrgId: string | null = existingEmployer
      ? ((await adminSupabase.from('employers').select('organization_id').eq('id', existingEmployer.id).maybeSingle()).data?.organization_id ?? null)
      : null;
    if (!resolvedOrgId) {
      // Try by country_code, then by country name
      const byCode = employerCountryCode
        ? (await adminSupabase.from('organizations').select('id').eq('country_code', employerCountryCode).maybeSingle()).data?.id
        : null;
      const byName = !byCode && employer.country
        ? (await adminSupabase.from('organizations').select('id').eq('country', employer.country).maybeSingle()).data?.id
        : null;
      resolvedOrgId = byCode ?? byName ?? null;
    }
    if (!resolvedOrgId) {
      console.warn(`[Employer KYC Review] No organization found for country=${employer.country}. advances will fail until organization_id is set manually.`);
    }

    const syncPayload = {
      user_id:             employer.user_id,
      company_name:        employer.company_name || 'Unknown company',
      company_code:        canonicalCode,
      employer_code:       canonicalCode,
      onboarding_id:       employer.id,
      organization_id:     resolvedOrgId,
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
    // Capture the live employers.id so we can explicitly stamp employee_onboarding below.
    // The DB trigger (trg_employers_stamp_live_employer_id) also does this, but we do it
    // explicitly here too because the approval trigger fires before this INSERT exists.
    let liveEmployersId: string | null = existingEmployer?.id ?? null;

    if (existingEmployer) {
      const { error: syncError } = await adminSupabase.from('employers').update(syncPayload).eq('id', existingEmployer.id);
      if (syncError) {
        console.error('[Employer KYC Review] employers UPDATE failed:', syncError);
      }
    } else {
      const { data: newEmployer, error: syncError } = await adminSupabase
        .from('employers')
        .insert({ ...syncPayload, employer_id: employer.user_id, created_at: new Date().toISOString() })
        .select('id')
        .single();
      if (syncError) {
        console.error('[Employer KYC Review] employers INSERT failed:', syncError);
        // Non-fatal — continue so admin isn't blocked
      } else {
        liveEmployersId = newEmployer?.id ?? null;
      }
    }

    if (liveEmployersId) {
      // Step 3a — Stamp live_employer_id on any employee_onboarding rows that were
      // submitted before this employer was approved (the DB trigger covers going-forward;
      // this explicit call covers the window between the approval UPDATE and this INSERT).
      const { error: stampError } = await adminSupabase
        .from('employee_onboarding')
        .update({ live_employer_id: liveEmployersId })
        .eq('employer_id', employer.id)
        .is('live_employer_id', null);
      if (stampError) {
        console.error('[Employer KYC Review] live_employer_id stamp failed:', stampError.message);
      }

      // Step 3b — profiles.company_code update is safe now: employers row is committed.
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

  // Audit trail — record every KYC decision with reviewer identity and reason
  void adminSupabase.from('system_audit_logs').insert({
    admin_id: user.id,
    admin_name: user.email ?? user.id,
    target_id: appId,
    target_type: 'employer_onboarding',
    action: `kyc_${status}`,
    new_value: { status, notes: notes || null },
    metadata: { company_name: employer.company_name, country: employer.country },
  });

  return NextResponse.json({
    message: 'Employer review submitted successfully',
    data: {
      employer_id: employer.id,
      status,
    },
  });
}
