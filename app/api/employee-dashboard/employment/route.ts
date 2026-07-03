// SCHEMA NOTE: employer_onboarding uses max_advance_percentage + cooldown_period
// employers uses advance_limit_percent + cooldown_days
// Do not swap these — they are different columns on different tables
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();

    const { data: onboarding, error: onboardingError } = await supabase
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
        risk_score,
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


    const { data: employeeRecord, error: employeeRecordError } = await supabase
     .from('employees')
     .select('id')
     .eq('user_id', user.id)
     .maybeSingle();

    if (employeeRecordError || !employeeRecord) {
     return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
    }

    const liveEmployeeId = employeeRecord.id;

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

    const { data: employeeEwa } = await adminSupabase
      .from('employee_ewa_settings')
      .select('max_advance_percentage')
      .eq('employee_id', liveEmployeeId)
      .maybeSingle();

    let effectivePct = policy?.withdrawal_limit_percent ?? 50;
    if (employeeEwa && employeeEwa.max_advance_percentage) {
      effectivePct = employeeEwa.max_advance_percentage;
    } else {
      // SCHEMA: read advance_limit_percent from employers (live config), not employer_onboarding.
      // employer_onboarding.max_advance_percentage is an onboarding-time snapshot only.
      const { data: employerLive } = await adminSupabase
        .from('employers')
        .select('advance_limit_percent')
        .eq('onboarding_id', onboarding.employer_id)
        .maybeSingle();
      if (employerLive?.advance_limit_percent) {
        effectivePct = employerLive.advance_limit_percent;
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
