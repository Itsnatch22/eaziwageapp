import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createRouteHandlerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const ip         = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `employer-search:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

  const { data: employer, error: employerError } = await supabase
    .from('employers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (employerError || !employer) {
    return NextResponse.json({ results: [] }, { status: 200, headers: rateResult.headers });
  }

  try {
    const [employeesRes, advancesRes] = await Promise.all([
      supabase
        .from('employees')
        .select('id, full_name')
        .eq('employer_id', employer.id)
        .ilike('full_name', `%${query}%`)
        .limit(6),
      supabase
        .from('advances')
        .select('id, reference')
        .eq('employer_id', employer.id)
        .ilike('reference', `%${query}%`)
        .limit(6),
    ]);

    const employees = employeesRes.data || [];
    const advances = advancesRes.data || [];

    const results = [
      ...employees.map((e) => ({
        type: 'employee',
        id: e.id,
        title: e.full_name || 'Unknown Employee',
        href: `/dashboards/employer-dashboard/employees?id=${e.id}`,
      })),
      ...advances.map((a) => ({
        type: 'advance',
        id: a.id,
        title: `Advance ${a.reference ?? a.id}`,
        href: `/dashboards/employer-dashboard/advances?id=${a.id}`,
      })),
    ];

    return NextResponse.json({ results }, { status: 200, headers: rateResult.headers });
  } catch (error) {
    console.error('[GET /api/employer-dashboard/search] Error:', error);
    return NextResponse.json(
      { error: 'Search failed.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}
