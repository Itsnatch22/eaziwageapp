import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

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
