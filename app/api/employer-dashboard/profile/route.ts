import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrencyFromCountry } from '@/lib/utils';
import pusherServer from '@/lib/pusher-server';

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
      'id, company_name, registration_number, industry, sector, physical_address, city, postal_code, county_region, country, status, contact_person, contact_email, contact_phone, contact_position, payroll_cycle, risk_rating, risk_score, bank_name, bank_account_number, tax_id, vat_number, certificate_of_incorporation, business_registration, tax_compliance_certificate, cr12_document, kra_pin_certificate, business_permit, audited_financials, bank_statement, proof_of_address, proof_of_bank_account, employment_contract_template, deleted_at',
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

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    
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
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (onboardingError) throw onboardingError;

    try {
      await pusherServer.trigger(`user-${user.id}`, 'kyc-update', {
        message: 'Profile updated successfully',
        type: 'profile_update'
      });
    } catch (pErr) {
      console.error('[Pusher] Trigger error:', pErr);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
    console.error('[POST /api/employer-dashboard/profile] Error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
