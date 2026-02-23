import { NextRequest, NextResponse } from 'next/server';
import { createClient }             from '@supabase/supabase-js';
import { getEnv }                   from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  // ── 1. Rate-limit ──────────────────────────────────────────────────────────
  const ip         = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-employer-detail:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

  // ── 2. Auth check (admin-only) ────────────────────────────────────────────
  // TODO: Replace with actual admin auth middleware/session check

  // ── 3. Supabase service-role client ───────────────────────────────────────
  const env      = getEnv();
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // ── 4. Fetch single employer ──────────────────────────────────────────────
  const { data: employer, error } = await supabase
    .from('employers')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !employer) {
    return NextResponse.json(
      { error: 'Employer not found.', code: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  // ── 5. Enrich with employee_count, total_advances, monthly_payroll ────────
  const { count: empCount } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('employer_id', id)
    .eq('status', 'active');

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: advanceData } = await supabase
    .from('advances')
    .select('amount')
    .eq('employer_id', id)
    .gte('created_at', startOfMonth);

  const totalAdvances = (advanceData || []).reduce((sum, a) => sum + (a.amount || 0), 0);

  const { data: salaryData } = await supabase
    .from('employees')
    .select('monthly_salary')
    .eq('employer_id', id)
    .eq('status', 'active');

  const monthlyPayroll = (salaryData || []).reduce((sum, e) => sum + (e.monthly_salary || 0), 0);

  return NextResponse.json(
    {
      ...employer,
      employee_count:  empCount || 0,
      total_advances:  totalAdvances,
      monthly_payroll: monthlyPayroll,
    },
    { status: 200, headers: rateResult.headers },
  );
}