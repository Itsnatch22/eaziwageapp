import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { redeliverNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: IdRouteContext
) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing notification id' }, { status: 400 });

    const result = await redeliverNotification(id);

    if (result.channel === 'error') {
      return NextResponse.json({ error: 'Notification not found or unexpected error' }, { status: 404 });
    }

    return NextResponse.json({ success: result.success, channel: result.channel });
  } catch (err) {
    console.error('[POST /api/admin/notifications/[id]/resend] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
