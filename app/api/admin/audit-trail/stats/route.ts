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

    const { data: logs, error, count } = await adminSupabase
      .from('system_audit_logs')
      .select('admin_id, admin_name, target_type', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01') {
        return NextResponse.json({ total_changes: 0, by_type: {}, by_admin: [] });
      }
      throw error;
    }

    const by_type: Record<string, number> = {};
    const by_admin = new Map<string, { admin_id: string; name: string; count: number }>();

    (logs || []).forEach((log) => {
      if (log.target_type) {
        by_type[log.target_type] = (by_type[log.target_type] || 0) + 1;
      }
      if (log.admin_id) {
        const existing = by_admin.get(log.admin_id);
        if (existing) {
          existing.count += 1;
        } else {
          by_admin.set(log.admin_id, {
            admin_id: log.admin_id,
            name: log.admin_name || 'Unknown',
            count: 1,
          });
        }
      }
    });

    const adminList = Array.from(by_admin.values()).sort((a, b) => b.count - a.count);

    return NextResponse.json({
      total_changes: count ?? logs?.length ?? 0,
      by_type,
      by_admin: adminList,
    });
  } catch (error) {
    console.error('[GET /api/admin/audit-trail/stats] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
