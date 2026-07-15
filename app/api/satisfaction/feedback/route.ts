import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { resolveDashboardRole } from '@/lib/services/resolve-dashboard-role';
import { SatisfactionFeedbackSchema } from '@/lib/validations/route-schemas';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `satisfaction-feedback:${ip}`);
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

    const parsed = SatisfactionFeedbackSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
    }

    const { rating, advance_id, moment } = parsed.data;
    // Derived server-side, never trusted from the client.
    const sentiment = rating >= 4 ? 'positive' : 'negative';

    const adminSupabase = createAdminClient();

    // advance_id is only meaningful for the withdrawal-triggered moment, and
    // only ever supplied by an employee. Verify it actually belongs to the
    // caller before storing it — on any mismatch, silently drop it rather
    // than rejecting the whole rating, since capturing the rating itself
    // shouldn't be blocked by this integrity edge case.
    let verifiedAdvanceId: string | null = null;
    if (advance_id && role === 'employee') {
      const { data: employeeRow } = await adminSupabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (employeeRow) {
        const { data: advanceRow } = await adminSupabase
          .from('advances')
          .select('id')
          .eq('id', advance_id)
          .eq('employee_id', employeeRow.id)
          .maybeSingle();
        if (advanceRow) verifiedAdvanceId = advanceRow.id;
      }
    }

    const { data: inserted, error: insertError } = await adminSupabase
      .from('satisfaction_feedback')
      .insert({
        user_id: user.id,
        role,
        advance_id: verifiedAdvanceId,
        sentiment,
        rating,
        trigger_moment: moment,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error('[Satisfaction Feedback] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save rating' }, { status: 500 });
    }

    // The rating itself is "the response" for cooldown purposes — this fires
    // regardless of star count, matching the 120-day active-rating cooldown.
    const { data: existingState } = await adminSupabase
      .from('satisfaction_prompt_state')
      .select('prompt_count')
      .eq('user_id', user.id)
      .maybeSingle();

    const now = new Date().toISOString();
    const { error: stateError } = await adminSupabase
      .from('satisfaction_prompt_state')
      .upsert(
        {
          user_id: user.id,
          prompt_count: existingState?.prompt_count ?? 0,
          last_response_at: now,
          updated_at: now,
        },
        { onConflict: 'user_id' },
      );

    if (stateError) {
      // Non-fatal — the rating is already saved; log for investigation.
      console.error('[Satisfaction Feedback] Prompt state update failed:', stateError);
    }

    return NextResponse.json({ id: inserted.id });
  } catch (error) {
    console.error('[Satisfaction Feedback] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
