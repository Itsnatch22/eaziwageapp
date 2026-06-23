import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';

export async function PATCH(
  req: NextRequest,
  { params }: IdRouteContext
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await req.json();
    const status = typeof body?.status === 'string' ? body.status.trim() : null;

    const allowed = ['open', 'in_progress', 'resolved', 'closed', 'pending'];
    if (!status || !allowed.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    const { data: ticket, error } = await adminSupabase
      .from('support_tickets')
      .update({ status })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ success: true, ticket: ticket || null });
  } catch (error) {
    console.error('[PATCH /api/support/tickets/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
