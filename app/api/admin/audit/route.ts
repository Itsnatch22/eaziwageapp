import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get('target_id');

    if (!targetId) {
      return NextResponse.json({ error: 'target_id is required' }, { status: 400 });
    }

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    const { data: logs, error } = await adminSupabase
      .from('system_audit_logs')
      .select('id, admin_id, admin_name, target_id, target_type, action, old_value, new_value, metadata, created_at')
      .eq('target_id', targetId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01') {
        return NextResponse.json([]);
      }
      throw error;
    }

    return NextResponse.json(logs || []);
  } catch (error) {
    console.error('[GET /api/admin/audit] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
