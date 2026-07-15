import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { resolveDashboardRole } from '@/lib/services/resolve-dashboard-role';
import { isEligibleForPrompt, type SatisfactionPromptStateRow } from '@/lib/services/satisfaction-eligibility';

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = await resolveDashboardRole(supabase, user.id);
    if (!role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const adminSupabase = createAdminClient();
    const { data: state, error: stateError } = await adminSupabase
      .from('satisfaction_prompt_state')
      .select('prompt_count, last_prompted_at, last_response_at, last_dismissed_at, dismissal_count, last_dismiss_type')
      .eq('user_id', user.id)
      .maybeSingle();

    if (stateError) {
      console.error('[Satisfaction Status] Fetch error:', stateError);
      return NextResponse.json({ error: 'Failed to check satisfaction prompt status' }, { status: 500 });
    }

    const result = isEligibleForPrompt(state as SatisfactionPromptStateRow | null);

    return NextResponse.json({
      eligible: result.eligible,
      reason: result.reason ?? null,
      nextEligibleAt: result.nextEligibleAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('[Satisfaction Status] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
