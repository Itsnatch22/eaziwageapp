import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { resolveDashboardRole } from '@/lib/services/resolve-dashboard-role';
import { SatisfactionPromptShownSchema } from '@/lib/validations/route-schemas';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `satisfaction-prompt-shown:${ip}`);
  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

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

    const parsed = SatisfactionPromptShownSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
    }

    const adminSupabase = createAdminClient();
    const { data: existing } = await adminSupabase
      .from('satisfaction_prompt_state')
      .select('prompt_count')
      .eq('user_id', user.id)
      .maybeSingle();

    const now = new Date().toISOString();
    const { error: upsertError } = await adminSupabase
      .from('satisfaction_prompt_state')
      .upsert(
        {
          user_id: user.id,
          prompt_count: (existing?.prompt_count ?? 0) + 1,
          last_prompted_at: now,
          updated_at: now,
        },
        { onConflict: 'user_id' },
      );

    if (upsertError) {
      console.error('[Satisfaction PromptShown] Upsert error:', upsertError);
      return NextResponse.json({ error: 'Failed to record prompt view' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Satisfaction PromptShown] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
