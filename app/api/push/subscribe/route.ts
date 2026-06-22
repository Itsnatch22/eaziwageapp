import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { getEnv } from '@/env';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const subscription = body?.subscription;
    if (!subscription) return NextResponse.json({ error: 'Missing subscription' }, { status: 400 });


    try {
      const { createClient } = await import('@supabase/supabase-js');
      const env = getEnv();
      const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

      await admin.from('system_push_subscriptions').upsert({ user_id: user.id, subscription_payload: subscription, active: true }, { onConflict: 'user_id,endpoint' });
    } catch (persistErr) {
      console.error('[push][subscribe] persist error:', { userId: user?.id, err: persistErr });

    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[push][subscribe] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
