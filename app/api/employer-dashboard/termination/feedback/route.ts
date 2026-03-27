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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reason, other_reason, additional_comments } = await req.json();

    if (!reason) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    }

    const { data: employer } = await adminSupabase
      .from('employer_onboarding')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { error: feedbackError } = await adminSupabase
      .from('termination_feedback')
      .insert({
        user_id: user.id,
        employer_id: employer?.id,
        reason,
        other_reason,
        additional_comments
      });

    if (feedbackError) throw feedbackError;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[Feedback API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
