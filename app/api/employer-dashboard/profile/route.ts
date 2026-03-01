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

  const { data: profile, error } = await supabase
    .from('employer_onboarding')
    .select(
      'id, company_name, industry, city, country, status, contact_person, contact_email, payroll_cycle, risk_rating, risk_score',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: 'No employer profile found.' }, { status: 404 });
  }

  // Surface full_name as the contact person so EmployerPortalLayout is happy
  return NextResponse.json({
    profile: {
      ...profile,
      full_name: profile.contact_person,
    },
  });
}