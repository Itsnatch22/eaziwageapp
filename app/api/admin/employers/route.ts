import { NextRequest, NextResponse } from 'next/server';
import { createClient }             from '@supabase/supabase-js';
import { getEnv }                   from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── 1. Rate-limit ──────────────────────────────────────────────────────────
  const ip         = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-employers:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

  // ── 2. Auth check (admin-only route) ──────────────────────────────────────
  // TODO: Replace with actual admin auth middleware/session check
  // For now, assuming a valid admin session exists
  
  // Example:
  // const session = await getSession(req);
  // if (!session || session.user.role !== 'admin') {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  // ── 3. Supabase service-role client ───────────────────────────────────────
  const env      = getEnv();
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // ── 4. Fetch all employers with aggregated stats ──────────────────────────
  const { data: employers, error } = await supabase
    .from('employers')
    .select(`
      id,
      company_name,
      employer_code,
      industry,
      country,
      registration_number,
      tax_id,
      address,
      contact_person,
      contact_email,
      contact_phone,
      payroll_cycle,
      status,
      risk_score,
      created_at,
      updated_at
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[GET /api/admin/employers] Supabase error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employers.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }

  // ── 5. Enrich each employer with employee_count, total_advances, monthly_payroll
  const enriched = await Promise.all(
    (employers || []).map(async emp => {
      // Count employees
      const { count: empCount } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('employer_id', emp.id)
        .eq('status', 'active');

      // Sum advances (this month)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: advanceData } = await supabase
        .from('advances')
        .select('amount')
        .eq('employer_id', emp.id)
        .gte('created_at', startOfMonth);

      const totalAdvances = (advanceData || []).reduce((sum, a) => sum + (a.amount || 0), 0);

      // Sum monthly payroll (from active employees)
      const { data: salaryData } = await supabase
        .from('employees')
        .select('monthly_salary')
        .eq('employer_id', emp.id)
        .eq('status', 'active');

      const monthlyPayroll = (salaryData || []).reduce((sum, e) => sum + (e.monthly_salary || 0), 0);

      return {
        ...emp,
        employee_count:  empCount || 0,
        total_advances:  totalAdvances,
        monthly_payroll: monthlyPayroll,
      };
    }),
  );

  return NextResponse.json(enriched, {
    status:  200,
    headers: rateResult.headers,
  });
}