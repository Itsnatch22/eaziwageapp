import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile for full_name and avatar
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();

    const { data: onboarding, error: onboardingError } = await adminSupabase
      .from('employee_onboarding')
      .select(`
        id,
        employee_code,
        job_title,
        department,
        monthly_salary,
        employment_type,
        start_date,
        status,
        employer_id,
        employer_onboarding (
          company_name
        )
      `)
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (onboardingError) throw onboardingError;
    if (!onboarding) {
      return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
    }

    // Merge profile data with onboarding data
    const employmentData = {
      ...onboarding,
      full_name: profile?.full_name || 'Not specified',
      avatar_url: profile?.avatar_url || null,
      employee_code: onboarding?.employee_code || 'EMP-' + user.id.slice(-6).toUpperCase()
    };

    const { data: policy, error: policyError } = await adminSupabase
      .from('policies')
      .select('*')
      .eq('organization_id', onboarding.employer_id)
      .maybeSingle();

    return NextResponse.json({
      employment: employmentData,
      policy: policy || {
        withdrawal_limit_percent: 50,
        frequency_cap: null,
        auto_approval_threshold: 500
      }
    });

  } catch (error: any) {
    console.error('[Employment API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
