import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { SatisfactionFeedbackCommentSchema } from '@/lib/validations/route-schemas';

// Attaches the optional follow-up "what went wrong" comment to a feedback
// row that was already created (rating is captured immediately on star
// click — see app/api/satisfaction/feedback/route.ts — so this only ever
// updates the comment field of an existing row the caller owns).
export async function PATCH(req: NextRequest, { params }: IdRouteContext) {
  const { id } = await params;

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `satisfaction-feedback-comment:${ip}`);
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

    const parsed = SatisfactionFeedbackCommentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
    }

    const adminSupabase = createAdminClient();
    const { data: row, error: fetchError } = await adminSupabase
      .from('satisfaction_feedback')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('[Satisfaction Feedback Comment] Fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to load feedback' }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }
    if (row.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: updateError } = await adminSupabase
      .from('satisfaction_feedback')
      .update({ comment: parsed.data.comment })
      .eq('id', id);

    if (updateError) {
      console.error('[Satisfaction Feedback Comment] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to save comment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Satisfaction Feedback Comment] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
