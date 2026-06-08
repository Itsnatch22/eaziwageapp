import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { GlobalPlatformSettingsSchema } from '@/lib/validations/admin-settings';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import pusherServer from '@/lib/pusher-server';

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function verifyAdmin(supabase: SupabaseClient, adminSupabase: SupabaseClient): Promise<User | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const access = await checkAdminAccess({ user, adminSupabase });
  if (!access.isAdmin) return null;

  return user;
}

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();
    const user = await verifyAdmin(supabase, adminSupabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();
    const user = await verifyAdmin(supabase, adminSupabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    await pusherServer.trigger('global-settings', 'platform-updated', validated);

    return NextResponse.json({ success: true, settings: validated });
  } catch (error) {
    console.error('[PUT /api/admin/settings/platform] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
