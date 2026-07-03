import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrencyFromCountry } from '@/lib/utils';
import { EmployerProfileUpdateSchema } from '@/lib/validations/route-schemas';

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
      'id, user_id, company_name, registration_number, industry, sector, physical_address, city, postal_code, county_region, country, status, current_step, contact_person, contact_email, contact_phone, contact_position, payroll_cycle, payday_day_of_month, mobile_money_provider, mobile_money_number, risk_rating, risk_score, bank_name, bank_account_number, tax_id, vat_number, employee_count, certificate_of_incorporation, business_registration, tax_compliance_certificate, cr12_document, kra_pin_certificate, business_permit, audited_financials, bank_statement, proof_of_address, proof_of_bank_account, employment_contract_template, deleted_at',
    )
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (onboardingError) {
    return NextResponse.json({ error: onboardingError.message }, { status: 500 });
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

  const documents = {
    certificate_of_incorporation: onboarding.certificate_of_incorporation,
    business_registration: onboarding.business_registration,
    tax_compliance_certificate: onboarding.tax_compliance_certificate,
    cr12_document: onboarding.cr12_document,
    kra_pin_certificate: onboarding.kra_pin_certificate,
    business_permit: onboarding.business_permit,
    audited_financials: onboarding.audited_financials,
    bank_statement: onboarding.bank_statement,
    proof_of_address: onboarding.proof_of_address,
    proof_of_bank_account: onboarding.proof_of_bank_account,
    employment_contract_template: onboarding.employment_contract_template,
  };

  return NextResponse.json({
    profile: {
      ...onboarding,
      documents,
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
    
    const { error: onboardingError } = await supabase
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
        mobile_money_number: body.mobileMoneyNumber,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (onboardingError) throw onboardingError;

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
