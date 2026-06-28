import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    const { data: tickets, error } = await adminSupabase
      .from('support_tickets')
      .select('id, user_id, subject, message, category, status, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ tickets: tickets || [] });
  } catch (error) {
    console.error('[GET /api/admin/support/tickets] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
