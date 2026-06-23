import { NextRequest, NextResponse } from 'next/server';
import { BlackoutPeriodSchema } from '@/lib/validations/admin-settings';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';

export async function PUT(req: NextRequest, { params }: IdRouteContext) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;
    const body = await req.json();
    const validated = BlackoutPeriodSchema.parse(body);
    const { data: current } = await adminSupabase.from('blackout_periods').select('*').eq('id', id).single();
    const { data, error } = await adminSupabase.from('blackout_periods').update({ ...validated, is_active: validated.is_active }).eq('id', id).select().single();
    if (error) throw error;
    await adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id, admin_name: user.email, target_id: id, target_type: 'blackout', action: 'update_blackout',
      old_value: current, new_value: data, created_at: new Date().toISOString()
    });
     return NextResponse.json(data);
  } catch (error) {
    console.error('[PUT /api/admin/settings/blackouts/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: IdRouteContext) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;
    const { data: current } = await adminSupabase.from('blackout_periods').select('*').eq('id', id).single();
    const { error } = await adminSupabase.from('blackout_periods').delete().eq('id', id);
    if (error) throw error;
    await adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id, admin_name: user.email, target_id: id, target_type: 'blackout', action: 'delete_blackout',
      old_value: current, created_at: new Date().toISOString()
    });
   return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/admin/settings/blackouts/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
