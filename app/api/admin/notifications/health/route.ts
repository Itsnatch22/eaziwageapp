import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const adminSupabase = createAdminClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Failed deliveries in last 24 hours
    const { data: failed } = await adminSupabase
      .from('notifications')
      .select('id, user_id, title, type, delivery_status, delivery_channel, failure_reason, created_at')
      .eq('delivery_status', 'failed')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50);

    // Delivery status breakdown for the last 24 hours
    const { data: allRecent } = await adminSupabase
      .from('notifications')
      .select('delivery_status')
      .gte('created_at', since);

    const breakdown = (allRecent ?? []).reduce<Record<string, number>>((acc, row) => {
      const s = (row.delivery_status as string) ?? 'pending';
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});

    // Users who have received at least one notification but have no active push subscription
    const { data: notifUserIds } = await adminSupabase
      .from('notifications')
      .select('user_id')
      .gte('created_at', since);

    const uniqueUserIds = [...new Set((notifUserIds ?? []).map(r => r.user_id as string))];

    let atRiskCount = 0;
    if (uniqueUserIds.length > 0) {
      const { data: withSubs } = await adminSupabase
        .from('system_push_subscriptions')
        .select('user_id')
        .eq('active', true)
        .in('user_id', uniqueUserIds);

      const coveredIds = new Set((withSubs ?? []).map(r => r.user_id as string));
      atRiskCount = uniqueUserIds.filter(id => !coveredIds.has(id)).length;
    }

    return NextResponse.json({
      failed: failed ?? [],
      breakdown,
      atRiskCount,
    });
  } catch (err) {
    console.error('[GET /api/admin/notifications/health] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
