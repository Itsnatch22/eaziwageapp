import { NextRequest, NextResponse } from 'next/server';
import { apiLimiter, checkRateLimit, mfaActionLimiter } from '@/lib/rate-limit';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { SecuritySessionDeleteSchema } from '@/lib/validations/route-schemas';

export async function handleSecuritySessionsGet(): Promise<NextResponse> {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rate = await checkRateLimit(apiLimiter, `security-sessions:${user.id}`);
    if (!rate.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rate.headers });
    }

    const { data, error } = await supabase
      .from('trusted_devices')
      .select('id, device_name, user_agent, ip_address, last_used_at')
      .eq('user_id', user.id)
      .order('last_used_at', { ascending: false });

    if (error) {
      console.error('[security-sessions] List failed:', { userId: user.id, error });
      return NextResponse.json({ error: 'Failed to load trusted devices' }, { status: 500 });
    }

    return NextResponse.json({ sessions: data ?? [] });
  } catch (error) {
    console.error('[security-sessions] List error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function handleSecuritySessionsDelete(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rate = await checkRateLimit(mfaActionLimiter, `security-sessions:${user.id}`);
    if (!rate.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rate.headers });
    }

    const parsed = SecuritySessionDeleteSchema.safeParse({
      id: new URL(req.url).searchParams.get('id'),
    });
    if (!parsed.success) return NextResponse.json({ error: 'A valid device id is required' }, { status: 422 });

    const { data, error } = await supabase
      .from('trusted_devices')
      .delete()
      .eq('id', parsed.data.id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[security-sessions] Delete failed:', { userId: user.id, error });
      return NextResponse.json({ error: 'Failed to remove trusted device' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Trusted device not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[security-sessions] Delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function handleSecuritySessionsPost(): Promise<NextResponse> {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rate = await checkRateLimit(mfaActionLimiter, `security-sessions-signout:${user.id}`);
    if (!rate.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rate.headers });
    }

    const { error } = await supabase.auth.signOut({ scope: 'others' });
    if (error) {
      console.error('[security-sessions] Sign out other sessions failed:', { userId: user.id, error });
      return NextResponse.json({ error: 'Failed to sign out other sessions' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[security-sessions] Sign out other sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
