
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiLimiter, checkRateLimit } from '@/lib/rate-limit';
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

type OnboardingRow = {
  id: string;
  user_id: string | null;
  employer_id: string | null;
  employee_code: string | null;
  full_name: string | null;
  full_name_placeholder?: string | null;
  email: string | null;
  email_placeholder?: string | null;
  job_title: string | null;
  department: string | null;
  employment_type: string | null;
  monthly_salary: number | null;
  country: string | null;
  city?: string | null;
  status: string | null;
  submitted_at: string | null;
  created_at: string | null;
  employer?: { company_name: string } | { company_name: string }[] | null;
};

function buildFromOnboarding(rows: OnboardingRow[], pendingKycByUserId: Map<string, number>) {
  return rows.map((emp) => ({
    id:               emp.id,
    user_id:          emp.user_id,
    employer_id:      emp.employer_id,
    employee_code:    emp.employee_code || 'N/A',
    full_name:        emp.full_name || emp.full_name_placeholder || 'Anonymous User',
    name:             emp.full_name || emp.full_name_placeholder || 'Anonymous User',
    email:            emp.email || emp.email_placeholder || null,
    phone:            null,
    country:          emp.country || null,
    job_title:        emp.job_title || 'Not Set',
    department:       emp.department || 'Not Set',
    monthly_salary:   Number(emp.monthly_salary ?? 0),
    advance_limit:    0,
    earned_wages:     0,
    employment_type:  emp.employment_type || 'full-time',
    hire_date:        null,
    termination_date: null,
    status:           normalizeEmployeeStatus(emp.status),
    kyc_status:       emp.status || 'pending',
    employer_name:    (Array.isArray(emp.employer) ? emp.employer[0]?.company_name : emp.employer?.company_name) || 'Unlinked',
    currency:         'KES',
    risk_score:       null,
    id_document_front: false,
    id_document_back:  false,
    selfie:            false,
    address_proof:     false,
    payslip_1:         false,
    payslip_2:         false,
    bank_statement:    false,
    employment_contract: false,
    pending_kyc_documents: emp.user_id ? pendingKycByUserId.get(emp.user_id) ?? 0 : 0,
    created_at:       emp.created_at,
    updated_at:       emp.created_at,
  }));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rateResult = await checkRateLimit(adminApiLimiter, `admin-employees:${ip}`);

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

    // Lightweight stats query — check employees first, fall back to employee_onboarding.
    // employees rows may not exist when employer was approved via the KYC review route
    // (which doesn't create an employers row), causing the FK insert to fail silently.
    const [statsResult, onboardingStatsResult, pendingKycResult] = await Promise.all([
      adminSupabase.from('employees').select('id, status, user_id'),
      adminSupabase.from('employee_onboarding').select('id, status, user_id, submitted_at'),
      adminSupabase.from('employee_kyc_documents').select('id, user_id').eq('status', 'pending'),
    ]);

    const liveEmployees     = statsResult.data ?? [];
    const onboardingRows    = (onboardingStatsResult.data ?? []).filter((e) => e.submitted_at); // exclude registration stubs

    // Use live employees for stats when they exist; otherwise fall back to onboarding.
    const allForStats = liveEmployees.length > 0 ? liveEmployees : onboardingRows;
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

    const pendingKycByUserId = new Map<string, number>();
    pendingKycDocs.forEach((doc) => {
      if (!doc.user_id) return;
      pendingKycByUserId.set(doc.user_id, (pendingKycByUserId.get(doc.user_id) ?? 0) + 1);
    });

    // When the live employees table is populated, use it (has FK to employers for company name).
    // When empty, fall back to employee_onboarding (source of truth for submitted KYC).
    let validatedEmployees: ReturnType<typeof buildFromOnboarding>;
    let total: number | null = 0;

    if (liveEmployees.length > 0) {
      // Resolve employer_id: may be employers.id (direct) or employer_onboarding.id (legacy)
      let resolvedEmployerId: string | undefined;
      if (employer_id) {
        const { data: resolved } = await adminSupabase
          .from('employers')
          .select('id')
          .eq('onboarding_id', employer_id)
          .maybeSingle();
        resolvedEmployerId = resolved?.id ?? employer_id;
      }

      let dataQuery = adminSupabase
        .from('employees')
        .select(`*, employers!employer_id(company_name)`, { count: 'exact' })
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
        dataQuery = dbValues.length === 1
          ? dataQuery.eq('status', dbValues[0])
          : dataQuery.in('status', dbValues);
      }
      if (resolvedEmployerId) {
        dataQuery = dataQuery.eq('employer_id', resolvedEmployerId);
      }

      const { data: employees, error: employeeErr, count: cnt } = await dataQuery;
      if (employeeErr) {
        console.error('[GET /api/admin/employees] Query error:', employeeErr);
        return NextResponse.json({ error: 'Failed to fetch employees', code: 'QUERY_ERROR' }, { status: 500 });
      }

      total = cnt;
      validatedEmployees = (employees ?? []).map((emp) => ({
        id:               emp.id,
        user_id:          emp.user_id,
        employer_id:      emp.employer_id,
        employee_code:    emp.employee_code || 'N/A',
        full_name:        emp.full_name || emp.name || 'Anonymous User',
        name:             emp.full_name || emp.name || 'Anonymous User',
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
        risk_rating:      emp.risk_rating ?? null,
        application_fee:  emp.application_fee_percent ?? null,
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
    } else {
      // Fallback: read from employee_onboarding (employees haven't been synced yet)
      let onboardingQuery = adminSupabase
        .from('employee_onboarding')
        .select(`
          id, user_id, employer_id, employee_code, full_name, full_name_placeholder,
          email, email_placeholder, job_title, department, employment_type, monthly_salary,
          country, city, status, submitted_at, created_at,
          employer:employer_onboarding!employer_id (company_name)
        `, { count: 'exact' })
        .not('submitted_at', 'is', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        const s = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
        onboardingQuery = onboardingQuery.or(
          `full_name.ilike.%${s}%,email.ilike.%${s}%,employee_code.ilike.%${s}%,job_title.ilike.%${s}%`,
        );
      }
      if (status) {
        const dbValues = STATUS_DB_MAP[status] ?? [status];
        onboardingQuery = dbValues.length === 1
          ? onboardingQuery.eq('status', dbValues[0])
          : onboardingQuery.in('status', dbValues);
      }
      if (employer_id) {
        onboardingQuery = onboardingQuery.eq('employer_id', employer_id);
      }

      const { data: onboarding, error: obErr, count: cnt } = await onboardingQuery;
      if (obErr) {
        console.error('[GET /api/admin/employees] Onboarding fallback query error:', obErr);
        return NextResponse.json({ error: 'Failed to fetch employees', code: 'QUERY_ERROR' }, { status: 500 });
      }

      total = cnt;
      validatedEmployees = buildFromOnboarding(onboarding ?? [], pendingKycByUserId);
    }

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
