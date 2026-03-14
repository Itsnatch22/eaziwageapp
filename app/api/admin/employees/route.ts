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

/**
 * Create admin Supabase client with service role
 */
function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * GET /api/admin/employees
 * List employees with optional filtering (admin only)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
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

    // Authenticate user
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

    // Parse and validate query parameters
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

    // 1. Fetch profiles where role='employee'
    let profileQuery = adminSupabase
      .from('profiles')
      .select('id, full_name, email, phone, company_code, created_at, role, role_normalized', { count: 'exact' })
      .eq('role', 'employee')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      profileQuery = profileQuery.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,company_code.ilike.%${search}%`
      );
    }

    const { data: profiles, error: profileErr, count } = await profileQuery;

    if (profileErr) {
      console.error('[GET /api/admin/employees] Profile query error:', profileErr);
      return NextResponse.json({ error: 'Failed to fetch profiles', code: 'QUERY_ERROR' }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ data: [], pagination: { total: 0, limit, offset, hasMore: false } }, { status: 200 });
    }

    const userIds = profiles.map(p => p.id);

    // 2. Fetch onboarding records for these users
    const { data: onboardingRecords } = await adminSupabase
      .from('employee_onboarding')
      .select(`
        *,
        employer:employer_onboarding!employer_id (
          company_name
        )
      `)
      .in('user_id', userIds);

    // 3. Merge data
    const validatedEmployees = profiles.map((p) => {
      const onboarding = (onboardingRecords || []).find(o => o.user_id === p.id);
      
      const flattened = {
        id:             p.id,
        user_id:        p.id,
        employer_id:    onboarding?.employer_id || null,
        employee_code:  onboarding?.employee_code || p.company_code || 'N/A',
        full_name:      onboarding?.full_name || p.full_name || 'Anonymous User',
        email:          onboarding?.email || p.email,
        phone:          onboarding?.phone || p.phone,
        job_title:      onboarding?.job_title || 'Not Set',
        department:     onboarding?.department || 'Not Set',
        monthly_salary: onboarding?.monthly_salary ? parseFloat(onboarding.monthly_salary as any) : 0,
        hire_date:      onboarding?.start_date || null,
        status:         (onboarding?.status === 'approved' ? 'active' : onboarding?.status || 'pending') as any,
        kyc_status:     onboarding?.status || 'pending',
        employer_name:  onboarding?.employer?.company_name || 'Unlinked',
        created_at:     p.created_at,
        updated_at:     onboarding?.updated_at || p.created_at,
      };

      // Apply status filter manually if provided (since it's now on joined data)
      if (status && flattened.status !== status) return null;
      if (employer_id && flattened.employer_id !== employer_id) return null;

      const parsed = EmployeeSchema.safeParse(flattened);
      return parsed.success ? parsed.data : flattened;
    }).filter(Boolean);

    return NextResponse.json(
      {
        data: validatedEmployees,
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit,
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
