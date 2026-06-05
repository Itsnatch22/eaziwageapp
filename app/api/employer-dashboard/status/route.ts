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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!employer) {
      return NextResponse.json({ 
        status: 'not_onboarded',
        message: 'No employer profile found' 
      });
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
