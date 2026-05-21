import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { checkAdminAccess } from '@/lib/server/admin-auth';

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await checkAdminAccess({ user, adminSupabase });
    if (!access.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: logs, error } = await adminSupabase
      .from('system_audit_logs')
      .select('admin_id, admin_name')
      .order('admin_name', { ascending: true });

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01') {
        return NextResponse.json([]);
      }
      throw error;
    }

    const adminMap = new Map<string, { id: string; name: string }>();
    (logs || []).forEach((log) => {
      if (!log.admin_id) return;
      if (!adminMap.has(log.admin_id)) {
        adminMap.set(log.admin_id, {
          id: log.admin_id,
          name: log.admin_name || 'Unknown',
        });
      }
    });

    return NextResponse.json(Array.from(adminMap.values()));
  } catch (error) {
    console.error('[GET /api/admin/audit-trail/admins] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
