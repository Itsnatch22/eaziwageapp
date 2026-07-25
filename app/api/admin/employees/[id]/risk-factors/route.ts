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

    // For three fields (employment_contract, recent_payslips, bank_statements_evidence)
    // prefer authoritative per-document values from employee_kyc_documents (by user_id)
    let rfAdjusted = rf || null;
    try {
      if ((emp as any).user_id) {
        const userIdForDocs = (emp as any).user_id as string;
        const { data: docs } = await adminSupabase
          .from('employee_kyc_documents')
          .select('document_type, status, created_at')
          .eq('user_id', userIdForDocs)
          .in('document_type', ['employment_contract', 'payslip_1', 'payslip_2', 'bank_statement']);

        const find = (t: string) => (docs || []).find(d => d.document_type === t);
        // employment_contract: approved -> 5, else 0
        const empContractDoc = find('employment_contract');
        const employment_contract_val = empContractDoc && empContractDoc.status === 'approved' ? 5 : 0;

        // recent_payslips: both payslips approved -> 5, one approved/under_review -> 3, else 1
        const p1 = find('payslip_1');
        const p2 = find('payslip_2');
        let recent_payslips_val = 1;
        const p1Approved = p1 && p1.status === 'approved';
        const p2Approved = p2 && p2.status === 'approved';
        const p1Pending = p1 && (p1.status === 'pending' || p1.status === 'under_review');
        const p2Pending = p2 && (p2.status === 'pending' || p2.status === 'under_review');
        if (p1Approved && p2Approved) recent_payslips_val = 5;
        else if (p1Approved || p2Approved || p1Pending || p2Pending) recent_payslips_val = 3;
        else recent_payslips_val = 1;

        // bank_statements_evidence: approved -> 5, pending/under_review -> 3, else 1
        const bs = find('bank_statement');
        let bank_statements_val = 1;
        if (bs && bs.status === 'approved') bank_statements_val = 5;
        else if (bs && (bs.status === 'pending' || bs.status === 'under_review')) bank_statements_val = 3;
        else bank_statements_val = 1;

        if (rfAdjusted) {
          rfAdjusted.employment_contract = employment_contract_val;
          rfAdjusted.recent_payslips = recent_payslips_val;
          rfAdjusted.bank_statements_evidence = bank_statements_val;
        } else {
          rfAdjusted = {
            verification_status: 0,
            tax_compliance: 0,
            consent_data_rights: 0,
            bank_mobile_wallet_verification: 0,
            employment_status: 0,
            employment_contract: employment_contract_val,
            recent_payslips: recent_payslips_val,
            bank_statements_evidence: bank_statements_val,
            notes: null,
            scored_by: null,
            scored_at: null,
            employee_id: emp.id,
          };
        }
      }
    } catch (e) {
      console.error('Failed to derive docs-based risk factors:', e);
    }

    return NextResponse.json({ success: true, data: { employee: emp, risk_factors: rfAdjusted || null } });
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
      .select('id, user_id, employer_id, full_name, risk_score, risk_rating')
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

    const prevScore = emp.risk_score ?? null;
    const prevRating = emp.risk_rating ?? null;

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

    // Re-read the employees row after the trigger ran so notifications can include final score/rating
    let updatedEmp: any = null;
    try {
      const { data: fresh } = await adminSupabase
        .from('employees')
        .select('id, user_id, employer_id, full_name, risk_score, risk_rating, application_fee_percent')
        .eq('id', emp.id)
        .maybeSingle();
      updatedEmp = fresh || null;
    } catch (e) {
      console.error('Failed to reload employee after upsert:', e);
    }

    // Notify employee (if linked to a profile) and employer dashboard user about the update.
    try {
      if (updatedEmp?.user_id) {
        void triggerNotification({
          target: 'employee',
          userId: updatedEmp.user_id,
          type: 'system_alert',
          title: 'Your risk profile was updated',
          message: `An admin updated your risk profile. Previous: ${prevScore ?? 'N/A'} (${prevRating ?? 'N/A'}). Now: ${updatedEmp.risk_score ?? 'N/A'} (${updatedEmp.risk_rating ?? 'N/A'}).`,
          metadata: { employeeId: emp.id, previousScore: prevScore, previousRating: prevRating, newScore: updatedEmp?.risk_score, newRating: updatedEmp?.risk_rating, adminId: user.id },
        });
      }

      if ((updatedEmp?.employer_id ?? emp.employer_id)) {
        const employerId = updatedEmp?.employer_id ?? emp.employer_id;
        const { data: employerRow } = await adminSupabase
          .from('employers')
          .select('user_id, company_name')
          .eq('id', employerId)
          .maybeSingle();
        if (employerRow?.user_id) {
          void triggerNotification({
            target: 'employer',
            userId: employerRow.user_id,
            type: 'risk_profile_updated',
            title: 'Employee risk profile updated',
            message: `Risk profile for ${updatedEmp?.full_name ?? emp.full_name ?? emp.id} was updated by an admin. Previous: ${prevScore ?? 'N/A'} (${prevRating ?? 'N/A'}). Now: ${updatedEmp?.risk_score ?? 'N/A'} (${updatedEmp?.risk_rating ?? 'N/A'}).`,
            metadata: { employeeId: emp.id, previousScore: prevScore, newScore: updatedEmp?.risk_score, previousRating: prevRating, newRating: updatedEmp?.risk_rating, applicationFee: updatedEmp?.application_fee_percent, companyName: employerRow.company_name },
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
