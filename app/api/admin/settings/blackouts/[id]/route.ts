import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { BlackoutPeriodSchema } from '@/lib/validations/admin-settings';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import pusherServer from '@/lib/pusher-server';

function createAdminClient() {
  const env = getEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function verifyAdmin(supabase: SupabaseClient, adminSupabase: SupabaseClient): Promise<User | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const access = await checkAdminAccess({ user, adminSupabase });
  if (!access.isAdmin) return null;

  return user;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();
    const user = await verifyAdmin(supabase, adminSupabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const validated = BlackoutPeriodSchema.parse(body);
    const { data: current } = await adminSupabase.from('blackout_periods').select('*').eq('id', id).single();
    const { data, error } = await adminSupabase.from('blackout_periods').update({ ...validated, is_active: validated.is_active ? 1 : 0 }).eq('id', id).select().single();
    if (error) throw error;
    await adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id, admin_name: user.email, target_id: id, target_type: 'blackout', action: 'update_blackout',
      old_value: current, new_value: data, created_at: new Date().toISOString()
    });
    await pusherServer.trigger('global-settings', 'blackout-updated', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[PUT /api/admin/settings/blackouts/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();
    const user = await verifyAdmin(supabase, adminSupabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: current } = await adminSupabase.from('blackout_periods').select('*').eq('id', id).single();
    const { error } = await adminSupabase.from('blackout_periods').delete().eq('id', id);
    if (error) throw error;
    await adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id, admin_name: user.email, target_id: id, target_type: 'blackout', action: 'delete_blackout',
      old_value: current, created_at: new Date().toISOString()
    });
    await pusherServer.trigger('global-settings', 'blackout-deleted', { id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/admin/settings/blackouts/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
