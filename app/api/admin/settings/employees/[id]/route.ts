import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { EmployeeSettingsSchema } from '@/lib/validations/admin-settings';
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
      .from('employee_onboarding')
      .select(`
        *,
        employer:employer_onboarding!employer_id (
          id, company_name, max_advance_percentage, cooldown_period
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    
    const { data: advances } = await adminSupabase
      .from('advances')
      .select('amount, status')
      .eq('employee_id', id);

    const totalAdvances = advances?.length || 0;
    const repaymentRate = 100; 

    return NextResponse.json({
      settings: data.settings || {},
      stats: { total_advances: totalAdvances, repayment_rate: repaymentRate },
      employer_settings: {
        employee_advance_limit_min: 10,
        employee_advance_limit_max: data.employer?.max_advance_percentage || 60,
        employee_cooldown_min: 1,
        employee_cooldown_max: 14
      }
    });
  } catch (error) {
    console.error('[GET /api/admin/settings/employees/[id]] Error:', error);
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
    const validated = EmployeeSettingsSchema.parse(body);

    const { data: current } = await adminSupabase.from('employee_onboarding').select('*').eq('id', id).single();

    const { data, error } = await adminSupabase
      .from('employee_onboarding')
      .update({
        settings: validated,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id, admin_name: user.email, target_id: id, target_type: 'employee', action: 'update_employee_settings',
      old_value: current, new_value: data, created_at: new Date().toISOString()
    });

    await pusherServer.trigger(`user-${id}`, 'settings-updated', validated);
    return NextResponse.json({ success: true, settings: validated });
  } catch (error) {
    console.error('[PUT /api/admin/settings/employees/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
