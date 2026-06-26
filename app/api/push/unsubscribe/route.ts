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
    const endpoint: string | undefined = body?.endpoint;
    const clearAll: boolean = body?.clearAll === true;

    if (!clearAll && !endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const env = getEnv();
      const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

      if (clearAll) {
        await admin.from('system_push_subscriptions').update({ active: false }).eq('user_id', user.id);
      } else {
        await admin.from('system_push_subscriptions').update({ active: false }).eq('user_id', user.id).eq('endpoint', endpoint!);
      }
    } catch (persistErr) {
      console.error('[push][unsubscribe] persist error:', { userId: user?.id, err: persistErr });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[push][unsubscribe] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
