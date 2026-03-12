import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NotificationSettingsSchema } from '@/lib/validations/admin-settings';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import pusherServer from '@/lib/pusher-server';

function createAdminClient() {
  const env = getEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function verifyAdmin(supabase: any, adminSupabase: any) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const access = await checkAdminAccess({ user, adminSupabase });
  if (!access.isAdmin) return null;

  return user;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();
    const user = await verifyAdmin(supabase, adminSupabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await adminSupabase.from('global_settings').select('notification_settings').eq('id', 'default').single();
    if (error && error.code !== 'PGRST116') throw error;
    return NextResponse.json(data?.notification_settings || {});
  } catch (error) {
    console.error('[GET /api/admin/settings/notifications] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();
    const user = await verifyAdmin(supabase, adminSupabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const validated = NotificationSettingsSchema.parse(body);
    const { data: current } = await adminSupabase.from('global_settings').select('notification_settings').eq('id', 'default').single();
    const { error } = await adminSupabase.from('global_settings').upsert({ id: 'default', notification_settings: validated, updated_at: new Date().toISOString() });
    if (error) throw error;
    await adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id, admin_name: user.email, target_id: 'notifications', target_type: 'notification_settings', action: 'update_notification_settings',
      old_value: current?.notification_settings || {}, new_value: validated, created_at: new Date().toISOString()
    });
    await pusherServer.trigger('global-settings', 'notifications-updated', validated);
    return NextResponse.json({ success: true, settings: validated });
  } catch (error) {
    console.error('[PUT /api/admin/settings/notifications] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
