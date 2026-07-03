import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { generateReportCsv, type ReportType } from '@/lib/services/report-generation';

type AdminUserMetadata = Record<string, unknown>;

type AdminUser = {
  id: string;
  email?: string | null;
  app_metadata?: AdminUserMetadata | null;
  user_metadata?: AdminUserMetadata | null;
};

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

export async function GET(
  req: NextRequest,
  { params }: IdRouteContext
): Promise<NextResponse> {
  const { id } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-reports-download:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

  const supabase = await createRouteHandlerClient();

  try {
    const { user, isAdmin } = await verifyAdminUser(supabase);

    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: report, error: fetchError } = await supabase
      .from('admin_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (report.status !== 'ready') {
      return NextResponse.json(
        { error: 'Report is not ready for download' },
        { status: 400 }
      );
    }

    // Reports generated after this feature shipped have their CSV captured as a
    // snapshot at generation time (report_data) — download always returns exactly
    // what was generated, not a live recompute. Older rows from before that change
    // fall back to the original behavior of recomputing live at download time.
    let csvContent = report.report_data as string | null;

    if (!csvContent) {
      try {
        const generated = await generateReportCsv(
          supabase,
          report.type as ReportType,
          report.period,
          { name: report.name, description: report.description },
          report.generated_at,
        );
        csvContent = generated.csv;
      } catch (error) {
        console.error('Error generating report data:', error);
        csvContent = `Report: ${report.name}
Description: ${report.description}
Generated: ${report.generated_at}
Type: ${report.type}
Period: ${report.period}

Error: Failed to generate report data. Please contact support.
`;
      }
    }

    const filename = `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        ...rateResult.headers,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('[GET /api/admin/reports/[id]/download] Error:', error);
    return NextResponse.json(
      { error: 'Failed to download report.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}
