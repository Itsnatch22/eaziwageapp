import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: IdRouteContext
) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;

    const { risk_score, reason } = await req.json() as { risk_score: number; reason?: string };

    if (typeof risk_score !== 'number' || risk_score < 0 || risk_score > 5) {
      return NextResponse.json({ error: 'risk_score must be a number between 0 and 5' }, { status: 400 });
    }

    const { data: emp } = await adminSupabase
      .from('employees')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const { error } = await adminSupabase
      .from('employees')
      .update({ risk_score, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    void adminSupabase.from('system_audit_logs').insert({
      admin_id:    user.id,
      admin_name:  user.email,
      target_id:   id,
      target_type: 'employee',
      action:      'risk_score_override',
      new_value:   { risk_score, reason: reason ?? null },
      created_at:  new Date().toISOString(),
    });

    return NextResponse.json({ success: true, risk_score });
  } catch (error) {
    console.error('[PATCH /api/admin/employees/[id]/risk-score] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
