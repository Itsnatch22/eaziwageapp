import { NextRequest, NextResponse } from 'next/server';
import { GlobalPlatformSettingsSchema } from '@/lib/validations/admin-settings';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    const { data, error } = await adminSupabase
      .from('global_settings')
      .select('platform_settings')
      .eq('id', 'default')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return NextResponse.json(data?.platform_settings || {});
  } catch (error) {
    console.error('[GET /api/admin/settings/platform] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;

    const body = await req.json();
    const validated = GlobalPlatformSettingsSchema.parse(body);

    const { data: current } = await adminSupabase
      .from('global_settings')
      .select('platform_settings')
      .eq('id', 'default')
      .single();

    const { error } = await adminSupabase
      .from('global_settings')
      .upsert({
        id: 'default',
        platform_settings: validated,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    await adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id,
      admin_name: user.email,
      target_id: 'platform',
      target_type: 'platform_settings',
      action: 'update_platform_settings',
      old_value: current?.platform_settings || {},
      new_value: validated,
      created_at: new Date().toISOString()
    });


    return NextResponse.json({ success: true, settings: validated });
  } catch (error) {
    console.error('[PUT /api/admin/settings/platform] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
