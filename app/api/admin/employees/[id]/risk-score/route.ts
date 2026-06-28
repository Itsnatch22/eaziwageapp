import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { EmployeeRiskScorePatchSchema } from '@/lib/validations/route-schemas';

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

    const raw = await req.json().catch(() => null);
    const rsParsed = EmployeeRiskScorePatchSchema.safeParse(raw);
    if (!rsParsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: rsParsed.error.issues },
        { status: 422 },
      );
    }
    const { risk_score, reason } = rsParsed.data;

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
