
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/server/admin-auth';

const QueryParamsSchema = z.object({
  employer_id: z.string().uuid().optional(),
  status:      z.enum(['active', 'inactive', 'suspended', 'terminated', 'pending']).optional(),
  search:      z.string().max(100).optional(),
  limit:       z.coerce.number().int().min(1).max(100).default(50),
  offset:      z.coerce.number().int().min(0).default(0),
});

// Maps normalised status back to the raw DB values stored in employees.status
const STATUS_DB_MAP: Record<string, string[]> = {
  active:     ['Active', 'approved'],
  inactive:   ['inactive'],
  suspended:  ['suspended'],
  terminated: ['terminated'],
  pending:    ['pending'],
};

function normalizeEmployeeStatus(status: string | null | undefined) {
  return status === 'Active' || status === 'approved'
    ? 'active'
    : status?.toLowerCase() || 'pending';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rateResult = await checkRateLimit(apiLimiter, `admin-employees:${ip}`);

    if (!rateResult.success) {
      return NextResponse.json(
        { error: 'Too many requests.', code: 'RATE_LIMITED' },
        { status: 429, headers: rateResult.headers },
      );
    }

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    const { searchParams } = new URL(req.url);
    const queryParams = QueryParamsSchema.safeParse({
      employer_id: searchParams.get('employer_id') || undefined,
      status:      searchParams.get('status')      || undefined,
      search:      searchParams.get('search')      || undefined,
      limit:       searchParams.get('limit')        || undefined,
      offset:      searchParams.get('offset')       || undefined,
    });

    if (!queryParams.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', code: 'VALIDATION_ERROR', details: queryParams.error.issues },
        { status: 400, headers: rateResult.headers },
      );
    }

    const { employer_id, status, search, limit, offset } = queryParams.data;

    // Lightweight stats query — no filters, minimal columns
    const [statsResult, pendingKycResult] = await Promise.all([
      adminSupabase.from('employees').select('id, status, user_id'),
      adminSupabase.from('employee_kyc_documents').select('id, user_id').eq('status', 'pending'),
    ]);

    const allForStats       = statsResult.data ?? [];
    const employeeUserIds   = new Set(allForStats.map((e) => e.user_id).filter(Boolean));
    const pendingKycDocs    = (pendingKycResult.data ?? []).filter(
      (d) => d.user_id && employeeUserIds.has(d.user_id),
    );

    const stats = {
      total:        allForStats.length,
      active:       allForStats.filter((e) => normalizeEmployeeStatus(e.status) === 'active').length,
      pending_kyc:  pendingKycDocs.length,
      suspended:    allForStats.filter((e) => normalizeEmployeeStatus(e.status) === 'suspended').length,
    };

    // Resolve employer_id: may be employers.id (direct) or employer_onboarding.id (legacy)
    let resolvedEmployerId: string | undefined;
    if (employer_id) {
      const directHit = allForStats.some((e: { id: string; status: string | null; user_id: string | null } & Record<string, unknown>) => (e as unknown as Record<string, string>)['employer_id'] === employer_id);
      if (directHit) {
        resolvedEmployerId = employer_id;
      } else {
        const { data: resolved } = await adminSupabase
          .from('employers')
          .select('id')
          .eq('onboarding_id', employer_id)
          .maybeSingle();
        resolvedEmployerId = resolved?.id ?? employer_id;
      }
    }

    // Paginated, DB-filtered data query
    let dataQuery = adminSupabase
      .from('employees')
      .select(
        `*, employers!employer_id(company_name)`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      const s = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
      dataQuery = dataQuery.or(
        `full_name.ilike.%${s}%,email.ilike.%${s}%,employee_code.ilike.%${s}%,job_title.ilike.%${s}%,department.ilike.%${s}%`,
      );
    }

    if (status) {
      const dbValues = STATUS_DB_MAP[status] ?? [status];
      if (dbValues.length === 1) {
        dataQuery = dataQuery.eq('status', dbValues[0]);
      } else {
        dataQuery = dataQuery.in('status', dbValues);
      }
    }

    if (resolvedEmployerId) {
      dataQuery = dataQuery.eq('employer_id', resolvedEmployerId);
    }

    const { data: employees, error: employeeErr, count: total } = await dataQuery;

    if (employeeErr) {
      console.error('[GET /api/admin/employees] Query error:', employeeErr);
      return NextResponse.json(
        { error: 'Failed to fetch employees', code: 'QUERY_ERROR' },
        { status: 500 },
      );
    }

    const pendingKycByUserId = new Map<string, number>();
    pendingKycDocs.forEach((doc) => {
      if (!doc.user_id) return;
      pendingKycByUserId.set(doc.user_id, (pendingKycByUserId.get(doc.user_id) ?? 0) + 1);
    });

    const validatedEmployees = (employees ?? []).map((emp) => ({
      id:               emp.id,
      user_id:          emp.user_id,
      employer_id:      emp.employer_id,
      employee_code:    emp.employee_code || 'N/A',
      full_name:        emp.full_name || emp.name || 'Anonymous User',
      name:             emp.name || emp.full_name || 'Anonymous User',
      email:            emp.email,
      phone:            emp.phone,
      country:          emp.country || null,
      job_title:        emp.job_title || 'Not Set',
      department:       emp.department || 'Not Set',
      monthly_salary:   emp.monthly_salary || 0,
      advance_limit:    emp.advance_limit || 0,
      earned_wages:     emp.earned_wages || 0,
      employment_type:  emp.employment_type || 'full-time',
      hire_date:        emp.hire_date || null,
      termination_date: emp.termination_date || null,
      status:           normalizeEmployeeStatus(emp.status),
      kyc_status:       emp.kyc_status || 'pending',
      employer_name:    emp.employers?.company_name || 'Unlinked',
      currency:         emp.currency || 'KES',
      risk_score:       emp.risk_score ?? null,
      id_document_front:    Boolean(emp.id_document_front),
      id_document_back:     Boolean(emp.id_document_back),
      selfie:               Boolean(emp.selfie),
      address_proof:        Boolean(emp.address_proof),
      payslip_1:            Boolean(emp.payslip_1),
      payslip_2:            Boolean(emp.payslip_2),
      bank_statement:       Boolean(emp.bank_statement),
      employment_contract:  Boolean(emp.employment_contract),
      pending_kyc_documents: emp.user_id ? pendingKycByUserId.get(emp.user_id) ?? 0 : 0,
      created_at:       emp.created_at,
      updated_at:       emp.updated_at,
    }));

    return NextResponse.json(
      {
        data:  validatedEmployees,
        stats,
        pagination: {
          total:   total ?? 0,
          limit,
          offset,
          hasMore: (total ?? 0) > offset + validatedEmployees.length,
        },
      },
      { status: 200, headers: rateResult.headers },
    );
  } catch (error) {
    console.error('[GET /api/admin/employees] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}
