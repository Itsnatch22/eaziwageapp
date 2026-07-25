import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { EmployeeRiskFactorsUpsertSchema } from '@/lib/validations/route-schemas';
import { triggerNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: IdRouteContext) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    // Resolve employee id (accept employees.id or employees.user_id)
    const { data: emp } = await adminSupabase
      .from('employees')
      .select('id, user_id, full_name, employer_id, risk_score, risk_rating')
      .or(`id.eq.${id},user_id.eq.${id}`)
      .maybeSingle();

    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const { data: rf, error: rfError } = await adminSupabase
      .from('employee_risk_factors')
      .select('*')
      .eq('employee_id', emp.id)
      .maybeSingle();

    if (rfError) throw rfError;

    return NextResponse.json({ success: true, data: { employee: emp, risk_factors: rf || null } });
  } catch (error) {
    console.error('[GET /api/admin/employees/[id]/risk-factors] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: IdRouteContext) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;

    const raw = await req.json().catch(() => null);
    const parsed = EmployeeRiskFactorsUpsertSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
    }

    // Resolve employee id (accept employees.id or employees.user_id)
    const { data: emp } = await adminSupabase
      .from('employees')
      .select('id')
      .or(`id.eq.${id},user_id.eq.${id}`)
      .maybeSingle();

    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const payload = {
      employee_id: emp.id,
      verification_status: parsed.data.verification_status,
      tax_compliance: parsed.data.tax_compliance,
      consent_data_rights: parsed.data.consent_data_rights,
      bank_mobile_wallet_verification: parsed.data.bank_mobile_wallet_verification,
      employment_status: parsed.data.employment_status,
      employment_contract: parsed.data.employment_contract,
      recent_payslips: parsed.data.recent_payslips,
      bank_statements_evidence: parsed.data.bank_statements_evidence,
      scored_by: user.id,
      scored_at: new Date().toISOString(),
      notes: parsed.data.notes ?? null,
    };

    const { error } = await adminSupabase
      .from('employee_risk_factors')
      .upsert(payload, { onConflict: 'employee_id' });

    if (error) throw error;

    void adminSupabase.from('system_audit_logs').insert({
      admin_id:    user.id,
      admin_name:  user.email,
      target_id:   emp.id,
      target_type: 'employee',
      action:      'risk_factors_upsert',
      new_value:   payload,
      created_at:  new Date().toISOString(),
    });

    // Notify employee (if linked to a profile) and employer dashboard user about the update.
    try {
      if (emp.user_id) {
        void triggerNotification({
          target: 'employee',
          userId: emp.user_id,
          type: 'system_alert',
          title: 'Risk profile updated',
          message: `An admin updated your risk profile for ${emp.id}. If you have questions contact support.`,
          metadata: { employeeId: emp.id, adminId: user.id },
        });
      }

      if (emp.employer_id) {
        const { data: employerRow } = await adminSupabase
          .from('employers')
          .select('user_id, company_name')
          .eq('id', emp.employer_id)
          .maybeSingle();
        if (employerRow?.user_id) {
          void triggerNotification({
            target: 'employer',
            userId: employerRow.user_id,
            type: 'risk_profile_updated',
            title: 'Employee risk profile updated',
            message: `Risk profile for ${emp.full_name ?? emp.id} was updated by an admin.`,
            metadata: { employeeId: emp.id, previousScore: emp.risk_score, newScore: null, companyName: employerRow.company_name },
          });
        }
      }
    } catch (notifErr) {
      console.error('[PATCH /api/admin/employees/[id]/risk-factors] Notification error:', notifErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PATCH /api/admin/employees/[id]/risk-factors] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
