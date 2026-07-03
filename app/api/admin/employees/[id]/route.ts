import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { getEnv } from '@/env';

interface EmployeeAdvanceRow {
  id: string;
  amount: number | string | null;
  fee_amount?: number | string | null;
  status: string | null;
  created_at: string | null;
}

interface KycDocumentRow {
  id: string;
  document_type: string;
  document_url: string;
  storage_path?: string | null;
  document_number?: string | null;
  status: string | null;
  reviewer_notes?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  expiry_date?: string | null;
  created_at: string | null;
  updated_at?: string | null;
}

export async function GET(
  req: NextRequest,
  { params }: IdRouteContext
) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    // `id` may be employees.id (normal case) or employee_onboarding.id (the admin
    // employees list falls back to onboarding rows when the live employees table
    // is globally empty) — .or(id.eq,user_id.eq) matches either, mirroring the
    // status route's already-correct resolution.
    const { data: liveEmployee } = await adminSupabase
      .from('employees')
      .select(`
        id, user_id, employer_id, employee_code, full_name, email, phone, country,
        job_title, department, hire_date, termination_date, monthly_salary,
        advance_limit, earned_wages, employment_type, status, kyc_status, risk_score,
        id_document_front, id_document_back, selfie, address_proof,
        payslip_1, payslip_2, bank_statement, employment_contract,
        created_at, updated_at,
        employers!employer_id ( company_name )
      `)
      .or(`id.eq.${id},user_id.eq.${id}`)
      .maybeSingle();

    let userId = liveEmployee?.user_id ?? null;
    if (!userId) {
      // No live employees row yet — resolve the real user_id via employee_onboarding
      // instead of assuming `id` itself is the user_id (it's employee_onboarding.id
      // in this fallback case, not the auth user id).
      const { data: onboardingRow } = await adminSupabase
        .from('employee_onboarding')
        .select('user_id')
        .or(`id.eq.${id},user_id.eq.${id}`)
        .maybeSingle();
      userId = onboardingRow?.user_id ?? id;
    }

    // profiles has no metadata column — selecting it errored on every request,
    // making this endpoint 404 unconditionally regardless of whether the
    // employee actually exists.
    const { data: empProfile, error: profileErr } = await adminSupabase
      .from('profiles')
      .select('id, full_name, email, phone, company_code, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr || (!empProfile && !liveEmployee)) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const { data: onboarding } = await adminSupabase
      .from('employee_onboarding')
      .select(`
        id, user_id, status, employer_id, employee_code, full_name, country,
        job_title, department, start_date, monthly_salary, advance_limit,
        earned_wages, employment_type, national_id, updated_at,
        employer:employer_onboarding!employer_id ( company_name )
      `)
      .eq('user_id', userId)
      .maybeSingle();

    let decryptedNationalId: string | null = null;
    if (onboarding?.national_id) {
      try {
        const { PII_ENCRYPTION_KEY } = getEnv();
        if (PII_ENCRYPTION_KEY) {
          const { data: dec } = await adminSupabase.rpc('admin_get_employee_national_id', {
            p_user_id: userId,
            p_key: PII_ENCRYPTION_KEY,
          });
          decryptedNationalId = dec ?? null;
        }
      } catch {
        // non-fatal — admin sees null rather than encrypted bytes
      }
    }

    const [advancesResult, kycDocumentsResult] = await Promise.all([
      adminSupabase
        .from('advances')
        .select('id, amount, fee_amount, status, created_at')
        .eq('employee_id', liveEmployee?.id ?? id)
        .order('created_at', { ascending: false }),
      adminSupabase
        .from('employee_kyc_documents')
        .select('id,document_type,document_url,storage_path,document_number,status,reviewer_notes,reviewed_at,reviewed_by,expiry_date,created_at,updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    const advanceRows = (advancesResult.data ?? []) as EmployeeAdvanceRow[];
    const kycDocuments = (kycDocumentsResult.data ?? []) as KycDocumentRow[];
    const outstandingStatuses = new Set(['processing', 'disbursed', 'completed']);
    const liveStatus = liveEmployee?.status === 'Active' || liveEmployee?.status === 'approved'
      ? 'active'
      : liveEmployee?.status?.toLowerCase() || onboarding?.status || 'pending';

    const advanceStats = {
      advance_count: advanceRows.length,
      total_advances: advanceRows.reduce((sum, advance) => sum + Number(advance.amount || 0), 0),
      pending_repayment: advanceRows
        .filter((advance) => advance.status && outstandingStatuses.has(advance.status))
        .reduce((sum, advance) => sum + Number(advance.amount || 0), 0),
      total_fees_paid: advanceRows
        .filter((advance) => advance.status === 'repaid')
        .reduce((sum, advance) => sum + Number(advance.fee_amount || 0), 0),
    };

    const responseData = {
      id: liveEmployee?.id ?? empProfile?.id,
      user_id: userId,
      employer_id: liveEmployee?.employer_id || onboarding?.employer_id || null,
      employee_code: liveEmployee?.employee_code || onboarding?.employee_code || empProfile?.company_code || 'N/A',
      full_name: liveEmployee?.full_name || onboarding?.full_name || empProfile?.full_name || 'Anonymous',
      email: liveEmployee?.email || empProfile?.email || null,
      phone: liveEmployee?.phone || empProfile?.phone || null,
      national_id: decryptedNationalId,
      country: liveEmployee?.country || onboarding?.country || null,
      job_title: liveEmployee?.job_title || onboarding?.job_title || 'Not Set',
      department: liveEmployee?.department || onboarding?.department || 'Not Set',
      hire_date: liveEmployee?.hire_date || onboarding?.start_date || null,
      termination_date: liveEmployee?.termination_date || null,
      monthly_salary: (() => {
        const salary = liveEmployee?.monthly_salary ?? onboarding?.monthly_salary;
        return typeof salary === 'number' ? salary : salary ? Number(salary) : 0;
      })(),
      advance_limit: liveEmployee?.advance_limit || onboarding?.advance_limit || 0,
      earned_wages: liveEmployee?.earned_wages || onboarding?.earned_wages || 0,
      employment_type: liveEmployee?.employment_type || onboarding?.employment_type || 'full-time',
      status: liveStatus,
      kyc_status: liveEmployee?.kyc_status || onboarding?.status || 'pending',
      risk_score: liveEmployee?.risk_score ?? null,
      employer_name: (liveEmployee?.employers as { company_name?: string } | null)?.company_name || (onboarding?.employer as { company_name?: string } | null)?.company_name || 'Unlinked',
      id_document_front: Boolean(liveEmployee?.id_document_front),
      id_document_back: Boolean(liveEmployee?.id_document_back),
      selfie: Boolean(liveEmployee?.selfie),
      address_proof: Boolean(liveEmployee?.address_proof),
      payslip_1: Boolean(liveEmployee?.payslip_1),
      payslip_2: Boolean(liveEmployee?.payslip_2),
      bank_statement: Boolean(liveEmployee?.bank_statement),
      employment_contract: Boolean(liveEmployee?.employment_contract),
      kyc_documents: kycDocuments,
      advance_stats: advanceStats,
      advances: advanceRows,
      created_at: liveEmployee?.created_at || empProfile?.created_at,
      updated_at: liveEmployee?.updated_at || onboarding?.updated_at || empProfile?.created_at,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('[GET /api/admin/employees/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: IdRouteContext
) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;

    const body = await req.json() as {
      job_title?: string;
      department?: string;
      monthly_salary?: number;
      employment_type?: string;
    };

    // The admin employees list falls back to employee_onboarding.id (instead of
    // employees.id) when the live employees table is globally empty — the same
    // `.or(id.eq,user_id.eq)` resolution the status route already uses, so `id`
    // resolves correctly whichever id space the list happened to hand back.
    const { data: emp } = await adminSupabase
      .from('employees')
      .select('id, user_id')
      .or(`id.eq.${id},user_id.eq.${id}`)
      .maybeSingle();

    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.job_title !== undefined) payload.job_title = body.job_title;
    if (body.department !== undefined) payload.department = body.department;
    if (body.monthly_salary !== undefined) payload.monthly_salary = Number(body.monthly_salary);
    if (body.employment_type !== undefined) payload.employment_type = body.employment_type;

    // Update employees and employee_onboarding in parallel
    await Promise.all([
      adminSupabase.from('employees').update(payload).eq('id', emp.id),
      adminSupabase.from('employee_onboarding').update(payload).eq('user_id', emp.user_id),
    ]);

    void adminSupabase.from('system_audit_logs').insert({
      admin_id:    user.id,
      admin_name:  user.email,
      target_id:   emp.id,
      target_type: 'employee',
      action:      'update_employment_details',
      new_value:   payload,
      created_at:  new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PUT /api/admin/employees/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
