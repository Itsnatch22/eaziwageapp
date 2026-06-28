import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { PushSubscribeSchema } from '@/lib/validations/route-schemas';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const subParsed = PushSubscribeSchema.safeParse(await req.json().catch(() => null));
    if (!subParsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: subParsed.error.issues },
        { status: 422 },
      );
    }
    const { subscription } = subParsed.data;


    const adminSupabase = createAdminClient();
    const { error: upsertErr } = await adminSupabase
      .from('system_push_subscriptions')
      .upsert({ user_id: user.id, subscription_payload: subscription, active: true }, { onConflict: 'user_id,endpoint' });

    if (upsertErr) {
      console.error('[push][subscribe] persist error:', { userId: user.id, err: upsertErr });
      return NextResponse.json({ error: 'Failed to save push subscription' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[push][subscribe] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
