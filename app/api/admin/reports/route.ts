import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { Redis } from '@upstash/redis';
import { z } from 'zod';
import { dbErrorResponse } from '@/lib/api-errors';

type AdminUser = Pick<User, 'id' | 'email' | 'app_metadata' | 'user_metadata'>;

interface ReportRow {
  status?: string | null;
  created_at?: string | null;
}

const ReportQuerySchema = z.object({
  type: z.enum(['all', 'financial', 'operational', 'compliance', 'performance']).default('all'),
  period: z.enum(['all', 'today', 'day', 'week', 'month', 'quarter', 'year', 'custom']).default('all'),
  search: z.string().optional(),
  page: z.string().transform(Number).default(1),
  limit: z.string().transform(Number).default(20),
});

const CreateReportSchema = z.object({
  name: z.string().min(1, 'Report name is required'),
  description: z.string().min(1, 'Description is required'),
  type: z.enum(['financial', 'operational', 'compliance', 'performance']),
  period: z.enum(['today', 'day', 'week', 'month', 'quarter', 'year', 'custom']),
  scheduled_for: z.string().datetime().optional(),
});

async function verifyAdminUser(supabase: SupabaseClient): Promise<{ user: AdminUser | null; isAdmin: boolean }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, isAdmin: false };
  }

  const adminSupabase = createAdminClient();
  const { data: systemAdmin } = await adminSupabase
    .from('system_admins')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle<{ is_admin: boolean }>();

  if (systemAdmin?.is_admin === true) {
    return { user, isAdmin: true };
  }

  const roleCandidates = [user.app_metadata?.role, user.user_metadata?.role]
    .filter((r): r is string => typeof r === 'string' && r.length > 0)
    .map((r) => r.toLowerCase());

  const allowedRoles = ['admin', 'super_admin', 'compliance', 'employer_admin'];
  const isAdminRoleFinal = roleCandidates.some((role) => allowedRoles.includes(role));

  return { user, isAdmin: isAdminRoleFinal };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-reports:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

  const env = getEnv();
  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  const { searchParams } = new URL(req.url);
  const parsed = ReportQuerySchema.safeParse({
    type: searchParams.get('type') ?? 'all',
    period: searchParams.get('period') ?? 'all',
    search: searchParams.get('search') ?? undefined,
    page: searchParams.get('page') ?? '1',
    limit: searchParams.get('limit') ?? '20',
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', detail: parsed.error.issues },
      { status: 422 },
    );
  }

  const { type, period, search, page, limit } = parsed.data;
  const cacheKey = `admin:reports:${type}:${period}:${search}:${page}:${limit}`;

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData && typeof cachedData === 'object') {
      console.log('[Admin Reports] Cache hit - returning cached data');
      return NextResponse.json(cachedData, {
        status: 200,
        headers: {
          ...rateResult.headers,
          'X-Cache': 'HIT'
        }
      });
    }
  } catch (cacheError) {
    console.warn('[Admin Reports] Cache check failed:', cacheError);
  }

  const supabase = await createRouteHandlerClient();

  try {
    const { user, isAdmin } = await verifyAdminUser(supabase);

    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let query = supabase
      .from('admin_reports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (type !== 'all') {
      query = query.eq('type', type);
    }

    if (period !== 'all') {
      query = query.eq('period', period);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: reports, error, count } = await query;

    if (error) {
      return dbErrorResponse('admin/reports', error, 'Failed to fetch reports');
    }

    const stats = {
      totalReports: count || 0,
      reportsThisMonth: 0,
      scheduledReports: 0,
      failedReports: 0,
    };

    if (reports && reports.length > 0) {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      (reports as ReportRow[]).forEach((report) => {
        if (report.status === 'scheduled') stats.scheduledReports++;
        if (report.status === 'failed') stats.failedReports++;
        
        if (report.created_at) {
          const reportDate = new Date(report.created_at);
          if (reportDate.getMonth() === currentMonth && reportDate.getFullYear() === currentYear) {
            stats.reportsThisMonth++;
          }
        }
      });
    }

    const responseData = {
      reports: reports || [],
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    };

    try {
      await redis.setex(cacheKey, 300, JSON.stringify(responseData));
      console.log('[Admin Reports] Data cached successfully');
    } catch (cacheError) {
      console.warn('[Admin Reports] Failed to cache data:', cacheError);
    }

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        ...rateResult.headers,
        'X-Cache': 'MISS'
      }
    });

  } catch (error) {
    console.error('[GET /api/admin/reports] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-reports-create:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

  const env = getEnv();
  const supabase = await createRouteHandlerClient();

  try {
    const { user, isAdmin } = await verifyAdminUser(supabase);

    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateReportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', detail: parsed.error.issues },
        { status: 422 }
      );
    }

    const { name, description, type, period } = parsed.data;

    const { data: report, error } = await supabase
      .from('admin_reports')
      .insert({
        name,
        description,
        type,
        period,
        status: 'generating',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return dbErrorResponse('admin/reports/create', error, 'Failed to create report');
    }

    const { data: readyReport, error: readyError } = await supabase
      .from('admin_reports')
      .update({
        status: 'ready',
        generated_at: new Date().toISOString(),
        download_url: `/api/admin/reports/${report.id}/download`,
      })
      .eq('id', report.id)
      .select()
      .single();

    if (readyError) {
      await supabase
        .from('admin_reports')
        .update({ status: 'failed' })
        .eq('id', report.id);

      return dbErrorResponse('admin/reports/ready', readyError, 'Failed to prepare report');
    }

    const redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });

    try {
      const keys = await redis.keys('admin:reports:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log('[Admin Reports] Cache cleared successfully');
      }
    } catch (cacheError) {
      console.warn('[Admin Reports] Failed to clear cache:', cacheError);
    }

    return NextResponse.json(readyReport, { 
      status: 201, 
      headers: rateResult.headers 
    });

  } catch (error) {
    console.error('[POST /api/admin/reports] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create report.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}
