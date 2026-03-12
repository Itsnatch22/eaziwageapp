import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { EmployerSettingsSchema } from '@/lib/validations/admin-settings';
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();
    const user = await verifyAdmin(supabase, adminSupabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await adminSupabase
      .from('employer_onboarding')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    
    // Return both existing columns and the settings JSONB
    return NextResponse.json({
      settings: data.settings || {
        advance_limit_percent: data.max_advance_percentage,
        cooldown_days: data.cooldown_period,
      }
    });
  } catch (error) {
    console.error('[GET /api/admin/settings/employers/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();
    const user = await verifyAdmin(supabase, adminSupabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const validated = EmployerSettingsSchema.parse(body);

    const { data: current } = await adminSupabase.from('employer_onboarding').select('*').eq('id', id).single();

    // Map back some fields for backward compatibility if columns exist
    const updateData: any = {
      settings: validated,
      updated_at: new Date().toISOString()
    };
    
    if (validated.advance_limit_percent !== undefined) updateData.max_advance_percentage = validated.advance_limit_percent;
    if (validated.cooldown_days !== undefined) updateData.cooldown_period = validated.cooldown_days;

    const { data, error } = await adminSupabase
      .from('employer_onboarding')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id, admin_name: user.email, target_id: id, target_type: 'employer', action: 'update_employer_settings',
      old_value: current, new_value: data, created_at: new Date().toISOString()
    });

    await pusherServer.trigger(`employer-${id}`, 'settings-updated', validated);
    return NextResponse.json({ success: true, settings: validated });
  } catch (error) {
    console.error('[PUT /api/admin/settings/employers/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
