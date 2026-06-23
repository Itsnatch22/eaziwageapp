import { NextRequest, NextResponse } from 'next/server';
import { BlackoutPeriodSchema } from '@/lib/validations/admin-settings';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;
    const { data, error } = await adminSupabase.from('blackout_periods').select('*').order('start_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[GET /api/admin/settings/blackouts] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;
    const body = await req.json();
    const validated = BlackoutPeriodSchema.parse(body);
    const { data, error } = await adminSupabase.from('blackout_periods').insert([{ ...validated, is_active: validated.is_active }]).select().single();
    if (error) throw error;
    await adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id, admin_name: user.email, target_id: data.id, target_type: 'blackout', action: 'create_blackout',
      new_value: data, created_at: new Date().toISOString()
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error('[POST /api/admin/settings/blackouts] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
