import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { EmployeeSchema, isAdminRole, UserRoleEnum } from '@/lib/validations/kyc-validation';

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

    // Check if user has admin role
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle<{ role: string | null }>();

    if (profileError) {
      console.error('[GET /api/admin/employees] Profile lookup error:', profileError);
      return NextResponse.json(
        { error: 'Failed to verify admin role.', code: 'ROLE_CHECK_FAILED' },
        { status: 500, headers: rateResult.headers }
      );
    }

    const candidateRoles = [
      profile?.role,
      user.app_metadata?.role,
      user.user_metadata?.role,
    ]
      .filter((role): role is string => typeof role === 'string' && role.length > 0)
      .map((role) => role.toLowerCase());

    const isAdmin = candidateRoles.some((role) => {
      const parsed = UserRoleEnum.safeParse(role);
      return parsed.success && isAdminRole(parsed.data);
    });
    if (!isAdmin) {
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

    // Build query with joins
    let query = adminSupabase
      .from('employees')
      .select(`
        *,
        employer:employer_onboarding!employer_id(company_name),
        onboarding:employee_onboarding!user_id(status)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (employer_id) {
      query = query.eq('employer_id', employer_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,employee_code.ilike.%${search}%`
      );
    }

    const { data: employees, error, count } = await query;

    if (error) {
      console.error('[GET /api/admin/employees] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch employees.', code: 'QUERY_ERROR' },
        { status: 500, headers: rateResult.headers }
      );
    }

    // Transform and validate response data
    const validatedEmployees = (employees || []).map((emp: any) => {
      const flattened = {
        ...emp,
        employer_name: emp.employer?.company_name || 'Unknown Employer',
        kyc_status:    emp.onboarding?.status || 'pending',
      };
      
      const parsed = EmployeeSchema.safeParse(flattened);
      if (!parsed.success) {
        console.warn('[Admin Employees] Validation failed for employee:', emp.id, parsed.error.format());
        // Still return the flattened data for the UI even if Zod is strict about minor fields
        return flattened; 
      }
      return parsed.data;
    });

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
