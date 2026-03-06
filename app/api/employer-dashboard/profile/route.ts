import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrencyFromCountry } from '@/lib/utils';

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
      'id, company_name, registration_number, industry, sector, physical_address, city, postal_code, county_region, country, status, contact_person, contact_email, contact_phone, contact_position, payroll_cycle, risk_rating, risk_score, bank_name, bank_account_number, tax_id, vat_number, certificate_of_incorporation, business_registration, tax_compliance_certificate, cr12_document, kra_pin_certificate, business_permit, audited_financials, bank_statement, proof_of_address, proof_of_bank_account, employment_contract_template',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (onboardingError) {
    return NextResponse.json({ error: onboardingError.message }, { status: 500 });
  }

  // Also fetch the company_code and avatar_url from the profile (which was generated at registration)
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
    // If no onboarding yet, at least return profile info if possible, or 404
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

  // Structure document URLs into a 'documents' object for the frontend
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

  // Surface full_name as the contact person so EmployerPortalLayout is happy
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
