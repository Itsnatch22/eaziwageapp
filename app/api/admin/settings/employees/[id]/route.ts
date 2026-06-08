import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { EmployeeSettingsSchema } from '@/lib/validations/admin-settings';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import pusherServer from '@/lib/pusher-server';

function createAdminClient() {
  const env = getEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function verifyAdmin(supabase: SupabaseClient, adminSupabase: SupabaseClient): Promise<User | null> {
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

    const { data: employee, error: empError } = await adminSupabase
      .from('employees')
      .select(`
        id,
        employer_id,
        employer:employers!employer_id (
          advance_limit_percent,
          cooldown_days,
          employee_advance_limit_min,
          employee_advance_limit_max,
          employee_cooldown_min,
          employee_cooldown_max
        )
      `)
      .eq('id', id)
      .single();

    if (empError || !employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const employer = Array.isArray(employee.employer)
      ? employee.employer[0]
      : employee.employer as {
          advance_limit_percent?: number;
          cooldown_days?: number;
          employee_advance_limit_min?: number;
          employee_advance_limit_max?: number;
          employee_cooldown_min?: number;
          employee_cooldown_max?: number;
        } | null;

    const { data: ewaSettings, error: ewaError } = await adminSupabase
      .from('employee_ewa_settings')
      .select('*')
      .eq('employee_id', id)
      .maybeSingle();

    if (ewaError) throw ewaError;

    const { data: advances } = await adminSupabase
      .from('advances')
      .select('status')
      .eq('employee_id', id);

    const totalAdvances = advances?.length || 0;
    const repaid = advances?.filter(
      (a) => a.status === 'repaid' || a.status === 'completed'
    ).length || 0;
    const repaymentRate = totalAdvances > 0 ? Math.round((repaid / totalAdvances) * 100) : 100;

    const settings = ewaSettings
      ? {
          use_custom_settings:  true,
          advance_limit_percent: ewaSettings.max_advance_percentage,
          cooldown_days:         ewaSettings.cooldown_period,
          max_monthly_advances:  null,
          fee_rate:              null,
          ewa_enabled:           ewaSettings.ewa_enabled,
          vip_status:            false,
          manual_approval:       false,
          on_watchlist:          false,
          admin_notes:           null,
        }
      : {
          use_custom_settings:  false,
          advance_limit_percent: employer?.advance_limit_percent ?? 50,
          cooldown_days:         employer?.cooldown_days ?? 7,
          max_monthly_advances:  null,
          fee_rate:              null,
          ewa_enabled:           true,
          vip_status:            false,
          manual_approval:       false,
          on_watchlist:          false,
          admin_notes:           null,
        };

    return NextResponse.json({
      settings,
      stats: { total_advances: totalAdvances, repayment_rate: repaymentRate },
      employer_settings: {
        employee_advance_limit_min: employer?.employee_advance_limit_min ?? 10,
        employee_advance_limit_max: employer?.employee_advance_limit_max ?? employer?.advance_limit_percent ?? 60,
        employee_cooldown_min:      employer?.employee_cooldown_min ?? 1,
        employee_cooldown_max:      employer?.employee_cooldown_max ?? 14,
      },
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

    const { data: employee, error: empError } = await adminSupabase
      .from('employees')
      .select('id, employer_id')
      .eq('id', id)
      .single();

    if (empError || !employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const { data: current } = await adminSupabase
      .from('employee_ewa_settings')
      .select('*')
      .eq('employee_id', id)
      .maybeSingle();

    if (!validated.use_custom_settings) {
      if (current) {
        await adminSupabase
          .from('employee_ewa_settings')
          .delete()
          .eq('employee_id', id);
      }

      await adminSupabase.from('system_audit_logs').insert({
        admin_id:    user.id,
        admin_name:  user.email,
        target_id:   id,
        target_type: 'employee',
        action:      'reset_employee_ewa_settings',
        old_value:   current ?? {},
        new_value:   { use_custom_settings: false },
        created_at:  new Date().toISOString(),
      });

      return NextResponse.json({ success: true, settings: validated });
    }

    const upsertPayload = {
      employee_id:            id,
      employer_live_id:       employee.employer_id,
      ewa_enabled:            validated.ewa_enabled ?? true,
      max_advance_percentage: validated.advance_limit_percent ?? 50,
      min_advance_amount:     500,
      max_advance_amount:     50000,
      cooldown_period:        validated.cooldown_days ?? 7,
      updated_by:             user.id,
      updated_at:             new Date().toISOString(),
    };

    const { data, error } = await adminSupabase
      .from('employee_ewa_settings')
      .upsert(upsertPayload, { onConflict: 'employee_id' })
      .select()
      .single();

    if (error) throw error;

    await adminSupabase.from('system_audit_logs').insert({
      admin_id:    user.id,
      admin_name:  user.email,
      target_id:   id,
      target_type: 'employee',
      action:      'update_employee_ewa_settings',
      old_value:   current ?? {},
      new_value:   data,
      created_at:  new Date().toISOString(),
    });

    await pusherServer.trigger(`user-${id}`, 'settings-updated', validated);
    return NextResponse.json({ success: true, settings: validated });
  } catch (error) {
    console.error('[PUT /api/admin/settings/employees/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}