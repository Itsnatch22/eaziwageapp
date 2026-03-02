import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

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
      'id, company_name, registration_number, industry, sector, physical_address, city, postal_code, county_region, country, status, contact_person, contact_email, contact_phone, contact_position, payroll_cycle, risk_rating, risk_score',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (onboardingError) {
    return NextResponse.json({ error: onboardingError.message }, { status: 500 });
  }

  // Also fetch the company_code from the profile (which was generated at registration)
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('company_code')
    .eq('id', user.id)
    .single();

  if (!onboarding) {
    // If no onboarding yet, at least return profile info if possible, or 404
    if (userProfile) {
        return NextResponse.json({
            profile: {
                company_code: userProfile.company_code,
                status: 'not_started'
            }
        });
    }
    return NextResponse.json({ error: 'No employer profile found.' }, { status: 404 });
  }

  // Surface full_name as the contact person so EmployerPortalLayout is happy
  return NextResponse.json({
    profile: {
      ...onboarding,
      company_code: userProfile?.company_code || onboarding.id.slice(0, 8).toUpperCase(),
      full_name: onboarding.contact_person,
    },
  });
}