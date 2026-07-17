import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrencyFromCountry } from '@/lib/utils';
import { EmployerProfileUpdateSchema } from '@/lib/validations/route-schemas';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getEnv } from '@/env';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: onboarding, error: onboardingError } = await supabase
    .from('employer_onboarding')
    .select(
      'id, user_id, company_name, registration_number, industry, sector, physical_address, city, postal_code, county_region, country, status, current_step, contact_person, contact_email, contact_phone, contact_position, payroll_cycle, payday_day_of_month, mobile_money_provider, risk_rating, risk_score, bank_name, tax_id, vat_number, employee_count, deleted_at',
    )
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (onboardingError) {
    return NextResponse.json({ error: onboardingError.message }, { status: 500 });
  }

  // mobile_money_number and bank_account_number are encrypted at rest
  // (bytea) — selected separately via decrypt RPCs rather than in the plain
  // select above, so a raw ciphertext value never accidentally leaks into a
  // response payload.
  let decryptedMobileMoneyNumber: string | null = null;
  let decryptedBankAccountNumber: string | null = null;
  if (onboarding) {
    const { PII_ENCRYPTION_KEY } = getEnv();
    if (PII_ENCRYPTION_KEY) {
      const [{ data: mmDec }, { data: bankDec }] = await Promise.all([
        createAdminClient().rpc('admin_get_employer_mobile_money', {
          p_onboarding_id: onboarding.id,
          p_key: PII_ENCRYPTION_KEY,
        }),
        createAdminClient().rpc('admin_get_employer_bank_account', {
          p_onboarding_id: onboarding.id,
          p_key: PII_ENCRYPTION_KEY,
        }),
      ]);
      decryptedMobileMoneyNumber = mmDec ?? null;
      decryptedBankAccountNumber = bankDec ?? null;
    }
  }

  const { data: userProfile } = await supabase
    .from('profiles')
    .select('company_code, phone_country_code, avatar_url')
    .eq('id', user.id)
    .single();

  const currency = getCurrencyFromCountry(
    onboarding?.country
      ?? userProfile?.phone_country_code
      ?? (user.user_metadata?.phone_country_code as string | undefined),
    'KES',
  );

  if (!onboarding) {
    if (userProfile) {
        return NextResponse.json({
            profile: {
                company_code: userProfile.company_code,
                avatar_url: userProfile.avatar_url,
                status: 'not_started',
                currency,
            }
        });
    }
    return NextResponse.json({ error: 'No employer profile found.' }, { status: 404 });
  }

  const { data: kycDocuments } = await supabase
    .from('employer_kyc_documents')
    .select('document_type, document_url, status, reviewer_notes')
    .eq('user_id', user.id);

  // Flat type->url map for simple "has this been uploaded" checks, kept for
  // existing consumers; `kycDocuments` below carries the full per-document
  // review state (status, reviewer_notes) for the rejection/resubmission flow.
  const documents = Object.fromEntries(
    (kycDocuments ?? []).map((d) => [d.document_type, d.document_url]),
  );

  return NextResponse.json({
    profile: {
      ...onboarding,
      mobile_money_number: decryptedMobileMoneyNumber,
      bank_account_number: decryptedBankAccountNumber,
      documents,
      kycDocuments: kycDocuments ?? [],
      currency,
      avatar_url: userProfile?.avatar_url,
      company_code: userProfile?.company_code || onboarding.id.slice(0, 8).toUpperCase(),
      full_name: onboarding.contact_person,
    },
  });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const profileParsed = EmployerProfileUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!profileParsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: profileParsed.error.issues },
        { status: 422 },
      );
    }
    const body = profileParsed.data;
    
    // mobile_money_number is encrypted at rest — written via
    // upsert_employer_onboarding_pii below, not stored raw here.
    const { data: updatedOnboarding, error: onboardingError } = await supabase
      .from('employer_onboarding')
      .update({
        company_name: body.companyName,
        contact_person: body.contactPerson,
        contact_email: body.contactEmail,
        contact_phone: body.contactPhone,
        payroll_cycle: body.payrollCycle,
        physical_address: body.physicalAddress,
        city: body.city,
        postal_code: body.postalCode,
        county_region: body.countyRegion,
        country: body.country,
        email_notifications: body.emailNotifications,
        advance_alerts: body.advanceAlerts,
        payroll_reminders: body.payrollReminders,
        weekly_reports: body.weeklyReports,
        max_advance_percentage: body.maxAdvancePercentage,
        min_advance_amount: body.minAdvanceAmount,
        max_advance_amount: body.maxAdvanceAmount,
        advance_access_days: body.advanceAccessDays,
        cooldown_period: body.cooldownPeriod,
        payday_day_of_month: body.paydayDayOfMonth,
        mobile_money_provider: body.mobileMoneyProvider,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();

    if (onboardingError) throw onboardingError;

    if (body.mobileMoneyNumber !== undefined && updatedOnboarding?.id) {
      const { PII_ENCRYPTION_KEY } = getEnv();
      if (!PII_ENCRYPTION_KEY) {
        return NextResponse.json({ error: 'Encryption not configured' }, { status: 500 });
      }
      // p_bank_account_number: null leaves the existing encrypted value
      // untouched (see upsert_employer_onboarding_pii's CASE guards) — this
      // route never edits the bank account, only mobile money.
      const { error: piiError } = await createAdminClient().rpc('upsert_employer_onboarding_pii', {
        p_onboarding_id: updatedOnboarding.id,
        p_bank_account_number: null,
        p_mobile_money_number: body.mobileMoneyNumber,
        p_key: PII_ENCRYPTION_KEY,
      });
      if (piiError) throw piiError;
    }

    // Already-approved employers operate off the `employers` table, not
    // employer_onboarding — payday/mobile-money/EWA limits need to land there
    // too so calculateDueDate(), the payday recoupment flow, and advance
    // eligibility (request-advance, overview) actually see them. Only these
    // fields are synced here; other profile fields are intentionally
    // onboarding-only (employers is promoted wholesale at KYC approval, not
    // kept in lockstep afterward).
    if (
      body.paydayDayOfMonth !== undefined || body.mobileMoneyProvider !== undefined || body.mobileMoneyNumber !== undefined ||
      body.maxAdvancePercentage !== undefined || body.minAdvanceAmount !== undefined || body.maxAdvanceAmount !== undefined ||
      body.cooldownPeriod !== undefined || body.advanceAccessDays !== undefined
    ) {
      await supabase
        .from('employers')
        .update({
          ...(body.paydayDayOfMonth !== undefined && { payday_day_of_month: body.paydayDayOfMonth }),
          ...(body.mobileMoneyProvider !== undefined && { mobile_money_provider: body.mobileMoneyProvider }),
          ...(body.mobileMoneyNumber !== undefined && { mobile_money_number: body.mobileMoneyNumber }),
          ...(body.maxAdvancePercentage !== undefined && { advance_limit_percent: body.maxAdvancePercentage }),
          ...(body.minAdvanceAmount !== undefined && { min_advance_amount: body.minAdvanceAmount }),
          ...(body.maxAdvanceAmount !== undefined && { max_advance_amount: body.maxAdvanceAmount }),
          ...(body.cooldownPeriod !== undefined && { cooldown_days: body.cooldownPeriod }),
          ...(body.advanceAccessDays !== undefined && { advance_access_days: body.advanceAccessDays }),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
    console.error('[PUT /api/employer-dashboard/profile] Error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
