import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: employer, error } = await supabase
      .from('employers')
      .select('id, status, onboarding_id, employer_onboarding!onboarding_id(deleted_at)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[employer/status] DB error:', error);
      return NextResponse.json({ error: 'Failed to fetch employer status' }, { status: 500 });
    }

    if (!employer) {
      // employers record may not exist yet (e.g. approval sync in progress).
      // Fall back to employer_onboarding so a freshly-approved employer isn't
      // stuck as 'not_onboarded' while the sync completes.
      const { data: onboardingRow } = await supabase
        .from('employer_onboarding')
        .select('status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ status: string }>();

      if (!onboardingRow) {
        return NextResponse.json({ status: 'not_onboarded', message: 'No employer profile found' });
      }

      const mapped =
        onboardingRow.status === 'approved' ? 'active' :
        onboardingRow.status === 'draft'    ? 'not_onboarded' :
        onboardingRow.status; // pending, rejected, risk_review_in_progress, etc.

      return NextResponse.json({ status: mapped, message: `Employer onboarding status: ${onboardingRow.status}` });
    }

    const onboarding = Array.isArray(employer.employer_onboarding)
      ? employer.employer_onboarding[0]
      : employer.employer_onboarding;

    if (onboarding?.deleted_at) {
      return NextResponse.json({ 
        status: 'terminated',
        message: 'Account has been terminated',
        deleted_at: onboarding.deleted_at
      });
    }

    if (employer.status !== 'approved') {
      return NextResponse.json({ 
        status: employer.status,
        message: `Employer status: ${employer.status}`
      });
    }

    return NextResponse.json({ 
      status: 'active',
      message: 'Employer is active'
    });

  } catch (error) {
    console.error('[Status API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
