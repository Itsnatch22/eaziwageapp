import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { EmployeeSchema } from '@/lib/validations/kyc-validation';
import { checkAdminAccess } from '@/lib/server/admin-auth';

const QueryParamsSchema = z.object({
  employer_id: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'suspended', 'terminated', 'pending']).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rateResult = await checkRateLimit(apiLimiter, `admin-employees:${ip}`);

    if (!rateResult.success) {
      return NextResponse.json(
        { error: 'Too many requests.', code: 'RATE_LIMITED' },
        { status: 429, headers: rateResult.headers }
      );
    }

    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401, headers: rateResult.headers }
      );
    }

    const adminAccess = await checkAdminAccess({ user, adminSupabase });
    if (adminAccess.error) {
      console.error('[GET /api/admin/employees] Role check error:', adminAccess.error);
      return NextResponse.json(
        { error: 'Failed to verify admin role.', code: 'ROLE_CHECK_FAILED' },
        { status: 500, headers: rateResult.headers }
      );
    }

    if (!adminAccess.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.', code: 'FORBIDDEN' },
        { status: 403, headers: rateResult.headers }
      );
    }

    const { searchParams } = new URL(req.url);
    const queryParams = QueryParamsSchema.safeParse({
      employer_id: searchParams.get('employer_id') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    });

    if (!queryParams.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: queryParams.error.issues,
        },
        { status: 400, headers: rateResult.headers }
      );
    }

    const { employer_id, status, search, limit, offset } = queryParams.data;

    // employees.employer_id → employers (FK)
    // employee_onboarding.employer_id → employer_onboarding (FK)
    const [employeesResult, onboardingResult] = await Promise.all([
      adminSupabase
        .from('employees')
        .select(`
          *,
          employers!employer_id (
            company_name
          )
        `)
        .order('created_at', { ascending: false }),

      adminSupabase
        .from('employee_onboarding')
        .select(`
          *,
          employer_onboarding!employer_id (
            company_name
          )
        `)
        .order('created_at', { ascending: false }),
    ]);

    const { data: employees, error: employeeErr } = employeesResult;
    const { data: onboardingEmployees, error: onboardingErr } = onboardingResult;

    if (employeeErr || onboardingErr) {
      console.error('[GET /api/admin/employees] Query error:', { employeeErr, onboardingErr });
      return NextResponse.json(
        { error: 'Failed to fetch employees', code: 'QUERY_ERROR' },
        { status: 500 }
      );
    }

    // Combine both datasets, prioritizing employees table for approved users
    const allEmployees = [...(employees || []), ...(onboardingEmployees || [])];

    // Remove duplicates — employees table takes priority (appears first)
    const uniqueEmployees = allEmployees.filter((emp, index, self) =>
      index === self.findIndex((e) => e.user_id === emp.user_id)
    );

    // Apply filters
    let filteredEmployees = uniqueEmployees;

    if (search) {
      const searchLower = search.toLowerCase();
      filteredEmployees = filteredEmployees.filter((emp) =>
        (emp.full_name && emp.full_name.toLowerCase().includes(searchLower)) ||
        (emp.name && emp.name.toLowerCase().includes(searchLower)) ||
        (emp.email && emp.email.toLowerCase().includes(searchLower)) ||
        (emp.employee_code && emp.employee_code.toLowerCase().includes(searchLower)) ||
        (emp.job_title && emp.job_title.toLowerCase().includes(searchLower)) ||
        (emp.department && emp.department.toLowerCase().includes(searchLower))
      );
    }

    if (status) {
      filteredEmployees = filteredEmployees.filter((emp) => {
        const empStatus =
          emp.status === 'Active' ? 'active' :
          emp.status === 'approved' ? 'active' :
          emp.status?.toLowerCase() || 'pending';
        return empStatus === status;
      });
    }

    if (employer_id) {
      filteredEmployees = filteredEmployees.filter((emp) => emp.employer_id === employer_id);
    }

    // Pagination
    const total = filteredEmployees.length;
    const paginatedEmployees = filteredEmployees.slice(offset, offset + limit);

    if (!paginatedEmployees || paginatedEmployees.length === 0) {
      return NextResponse.json(
        { data: [], pagination: { total: 0, limit, offset, hasMore: false } },
        { status: 200 }
      );
    }

    const validatedEmployees = paginatedEmployees
      .map((emp) => {
        const flattened = {
          id:             emp.id,
          user_id:        emp.user_id,
          employer_id:    emp.employer_id,
          employee_code:  emp.employee_code || 'N/A',
          full_name:      emp.full_name || emp.name || 'Anonymous User',
          name:           emp.name || emp.full_name || 'Anonymous User',
          email:          emp.email,
          phone:          emp.phone,
          job_title:      emp.job_title || 'Not Set',
          department:     emp.department || 'Not Set',
          monthly_salary: emp.monthly_salary || 0,
          hire_date:      emp.hire_date || emp.start_date || null,
          status: emp.status === 'Active' || emp.status === 'approved'
            ? 'active'
            : emp.status?.toLowerCase() || 'pending',
          kyc_status:     emp.kyc_status || emp.status || 'pending',
          // Resolve company name from correct join per table
          employer_name:  emp.employers?.company_name || emp.employer_onboarding?.company_name || 'Unlinked',
          created_at:     emp.created_at,
          updated_at:     emp.updated_at,
        };

        const parsed = EmployeeSchema.safeParse(flattened);
        return parsed.success ? parsed.data : flattened;
      })
      .filter(Boolean);

    return NextResponse.json(
      {
        data: validatedEmployees,
        pagination: {
          total,
          limit,
          offset,
          hasMore: total > offset + limit,
        },
      },
      {
        status: 200,
        headers: rateResult.headers,
      }
    );
  } catch (error) {
    console.error('[GET /api/admin/employees] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}