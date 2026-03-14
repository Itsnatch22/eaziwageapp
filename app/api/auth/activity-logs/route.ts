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

export async function GET(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch logs where this user is the target or the admin
    const { data: logs, error: logsError } = await adminSupabase
      .from('system_audit_logs')
      .select('*')
      .or(`admin_id.eq.${user.id},target_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (logsError) throw logsError;

    return NextResponse.json({ logs: logs || [] });
  } catch (error: any) {
    console.error('[Activity Logs API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
