import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const role    = searchParams.get('role');
  const resolved = searchParams.get('resolved');
  const search  = searchParams.get('search');
  const limit   = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 200);
  const page    = Math.max(parseInt(searchParams.get('page') ?? '1', 10) || 1, 1);
  const from    = (page - 1) * limit;
  const to      = from + limit - 1;

  const supabase = createAdminClient();

  let query = supabase
    .from('error_logs')
    .select('id, message, digest, stack, url, role, user_id, resolved, created_at', { count: 'exact' })
    .order('resolved', { ascending: true })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (role && role !== 'all') {
    query = query.eq('role', role);
  }
  if (resolved === 'true') {
    query = query.eq('resolved', true);
  } else if (resolved === 'false') {
    query = query.eq('resolved', false);
  }
  if (search) {
    query = query.or(`message.ilike.%${search}%,url.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[Admin Logs GET]', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }

  return NextResponse.json({ logs: data ?? [], total: count ?? 0 });
}
