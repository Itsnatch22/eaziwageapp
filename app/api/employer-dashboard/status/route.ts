// app/api/employer-dashboard/status/route.ts
// Returns employer status including termination info for access control
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check employer status (includes deleted_at for termination check)
    const { data: employer, error } = await supabase
      .from('employer_onboarding')
      .select('id, status, deleted_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
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

    if (employer.deleted_at) {
      return NextResponse.json({ 
        status: 'terminated',
        message: 'Account has been terminated',
        deleted_at: employer.deleted_at
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
