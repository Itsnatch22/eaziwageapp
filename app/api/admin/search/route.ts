import { NextRequest, NextResponse } from 'next/server';
import { createClient }             from '@supabase/supabase-js';
import { getEnv }                   from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const ip         = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-search:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

  const env      = getEnv();
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    // 1. Search Employers
    const { data: employers } = await supabase
      .from('employers')
      .select('id, company_name')
      .ilike('company_name', `%${query}%`)
      .limit(5);

    // 2. Search Employees
    const { data: employees } = await supabase
      .from('employees')
      .select('id, name, organization_id')
      .ilike('name', `%${query}%`)
      .limit(5);

    // 3. Search Advances (by Reference)
    const { data: advances } = await supabase
      .from('advances')
      .select('id, reference, employee_id')
      .ilike('reference', `%${query}%`)
      .limit(5);

    const results = [
      ...(employers || []).map(e => ({ type: 'employer', id: e.id, title: e.company_name, href: `/admin/employers?id=${e.id}` })),
      ...(employees || []).map(e => ({ type: 'employee', id: e.id, title: e.name, href: `/admin/employees?id=${e.id}` })),
      ...(advances || []).map(a => ({ type: 'advance', id: a.id, title: `Advance ${a.reference}`, href: `/admin/advances?id=${a.id}` })),
    ];

    return NextResponse.json({ results }, { status: 200, headers: rateResult.headers });

  } catch (error) {
    console.error('[GET /api/admin/search] Error:', error);
    return NextResponse.json(
      { error: 'Search failed.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}
