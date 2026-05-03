import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { Redis } from '@upstash/redis';

async function verifyAdminUser(supabase: any): Promise<{ user: any; isAdmin: boolean }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, isAdmin: false };
  }

  // Check environment admin emails first (most reliable)
  const env = getEnv();
  const adminEmails = (env.ADMIN_EMAILS || '')
    .replace(/^"|"$/g, '')
    .split(',')
    .map(e => e.trim().toLowerCase());
  const isEnvAdmin = adminEmails.includes(user.email?.toLowerCase() || '');

  if (isEnvAdmin) {
    return { user, isAdmin: true };
  }

  // Check user metadata roles
  const roleCandidates = [user.app_metadata?.role, user.user_metadata?.role]
    .filter((r): r is string => typeof r === 'string' && r.length > 0)
    .map((r) => r.toLowerCase());

  const allowedRoles = ['admin', 'super_admin', 'compliance', 'employer_admin'];
  const isAdminRoleFinal = roleCandidates.some((role) => allowedRoles.includes(role));

  return { user, isAdmin: isAdminRoleFinal };
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-reports-delete:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

  const env = getEnv();
  const supabase = await createRouteHandlerClient();

  try {
    // Verify the user is an admin using the same logic as admin me route
    const { user, isAdmin } = await verifyAdminUser(supabase);

    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First check if the report exists
    const { data: report, error: fetchError } = await supabase
      .from('admin_reports')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Delete the report
    const { error: deleteError } = await supabase
      .from('admin_reports')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Admin Reports] Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete report', detail: deleteError.message },
        { status: 500 }
      );
    }

    // Clear cache
    const redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });

    try {
      const keys = await redis.keys('admin:reports:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log('[Admin Reports] Cache cleared after delete');
      }
    } catch (cacheError) {
      console.warn('[Admin Reports] Failed to clear cache after delete:', cacheError);
    }

    return NextResponse.json(
      { success: true, message: 'Report deleted successfully' },
      { status: 200, headers: rateResult.headers }
    );

  } catch (error) {
    console.error('[DELETE /api/admin/reports/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete report.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}
