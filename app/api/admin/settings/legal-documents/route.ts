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
    const { data, error } = await adminSupabase.from('legal_documents').select('*').eq('is_active', 1);
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[GET /api/admin/settings/legal-documents] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
