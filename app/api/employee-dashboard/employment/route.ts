import { NextResponse } from 'next/server';
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

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
          company_name,
          max_advance_percentage
        )
      `)
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (onboardingError) throw onboardingError;
    if (!onboarding) {
      return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
    }

    const employmentData = {
      ...onboarding,
      full_name: profile?.full_name || 'Not specified',
      avatar_url: profile?.avatar_url || null,
      employee_code: onboarding?.employee_code || 'EMP-' + user.id.slice(-6).toUpperCase()
    };

    const { data: policy, error: policyError } = await adminSupabase
      .from('policies')
      .select('*')
      .eq('employer_id', onboarding.employer_id)
      .maybeSingle();

    if (policyError) {
      throw policyError;
    }

    type EmployerOnboarding = {
  company_name: string;
  max_advance_percentage: number;
};

// Determine effective EWA percentage to show on UI (employee override -> employer)
const { data: employeeEwa } = await adminSupabase
  .from('employee_ewa_settings')
  .select('max_advance_percentage')
  .eq('employee_onboarding_id', onboarding.id)
  .maybeSingle();

let effectivePct = policy?.withdrawal_limit_percent ?? 50;
if (employeeEwa && employeeEwa.max_advance_percentage) {
  effectivePct = employeeEwa.max_advance_percentage;
} else if (onboarding && onboarding.employer_onboarding) {
  const eo = Array.isArray(onboarding.employer_onboarding) 
    ? onboarding.employer_onboarding[0] 
    : onboarding.employer_onboarding;
  if (eo && (eo as EmployerOnboarding).max_advance_percentage) {
    effectivePct = (eo as EmployerOnboarding).max_advance_percentage;
  }
}

    return NextResponse.json({
      employment: employmentData,
      policy: {
        ...policy,
        withdrawal_limit_percent: effectivePct,
        frequency_cap: policy?.frequency_cap ?? null,
        auto_approval_threshold: policy?.auto_approval_threshold ?? 500,
      }
    });

  } catch (error: unknown) {
    console.error('[Employment API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
