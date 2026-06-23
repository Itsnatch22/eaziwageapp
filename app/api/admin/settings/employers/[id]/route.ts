import { NextRequest, NextResponse } from 'next/server';
import { EmployerSettingsSchema } from '@/lib/validations/admin-settings';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest, { params }: IdRouteContext) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    const { data, error } = await adminSupabase
      .from('employers')
      .select(`
        id,
        company_name,
        status,
        country,
        risk_score,
        risk_rating,
        advance_limit_percent,
        cooldown_days,
        min_advance_amount,
        processing_fee,
        funding_model,
        risk_tier,
        credit_limit,
        funding_buffer_percent,
        max_monthly_advances,
        employee_advance_limit_min,
        employee_advance_limit_max,
        employee_cooldown_min,
        employee_cooldown_max,
        ewa_enabled,
        instant_enabled,
        auto_approve,
        weekend_access
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    const settings = {
      advance_limit_percent:        data.advance_limit_percent,
      cooldown_days:                data.cooldown_days,
      processing_fee:               data.processing_fee,
      max_monthly_advances:         data.max_monthly_advances,
      employee_advance_limit_min:   data.employee_advance_limit_min,
      employee_advance_limit_max:   data.employee_advance_limit_max,
      employee_cooldown_min:        data.employee_cooldown_min,
      employee_cooldown_max:        data.employee_cooldown_max,
      funding_model:                data.funding_model,
      risk_tier:                    data.risk_tier,
      funding_buffer_percent:       data.funding_buffer_percent,
      credit_limit:                 data.credit_limit,
      ewa_enabled:                  data.ewa_enabled,
      instant_enabled:              data.instant_enabled,
      auto_approve:                 data.auto_approve,
      weekend_access:               data.weekend_access,
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[GET /api/admin/settings/employers/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: IdRouteContext) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;

    const body = await req.json();
    const validated = EmployerSettingsSchema.parse(body);

    const { data: current } = await adminSupabase
      .from('employers')
      .select('*')
      .eq('id', id)
      .single();

    const { data, error } = await adminSupabase
      .from('employers')
      .update({
        advance_limit_percent:      validated.advance_limit_percent,
        cooldown_days:              validated.cooldown_days,
        min_advance_amount:         validated.min_advance_amount,
        processing_fee:             validated.processing_fee,
        funding_model:              validated.funding_model,
        risk_tier:                  validated.risk_tier,
        credit_limit:               validated.credit_limit,
        funding_buffer_percent:     validated.funding_buffer_percent,
        max_monthly_advances:       validated.max_monthly_advances,
        employee_advance_limit_min: validated.employee_advance_limit_min,
        employee_advance_limit_max: validated.employee_advance_limit_max,
        employee_cooldown_min:      validated.employee_cooldown_min,
        employee_cooldown_max:      validated.employee_cooldown_max,
        ewa_enabled:                validated.ewa_enabled,
        instant_enabled:            validated.instant_enabled,
        auto_approve:               validated.auto_approve,
        weekend_access:             validated.weekend_access,
        updated_at:                 new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await adminSupabase.from('system_audit_logs').insert({
      admin_id:    user.id,
      admin_name:  user.email,
      target_id:   id,
      target_type: 'employer',
      action:      'update_employer_settings',
      old_value:   current ?? {},
      new_value:   data,
      created_at:  new Date().toISOString(),
    });

    return NextResponse.json({ success: true, settings: validated });
  } catch (error) {
    console.error('[PUT /api/admin/settings/employers/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
