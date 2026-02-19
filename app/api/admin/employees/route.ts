import { NextRequest, NextResponse } from 'next/server';
import { createClient }             from '@supabase/supabase-js';
import { getEnv }                   from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── 1. Rate-limit ──────────────────────────────────────────────────────────
  const ip         = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-employees:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

  // ── 2. Auth check (admin-only) ────────────────────────────────────────────
  // TODO: Replace with actual admin auth middleware/session check

  // ── 3. Parse query params ──────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const employerId       = searchParams.get('employer_id');

  // ── 4. Supabase service-role client ───────────────────────────────────────
  const env      = getEnv();
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // ── 5. Fetch employees (optionally filtered by employer_id) ──────────────
  let query = supabase
    .from('employees')
    .select('id, employer_id, employee_code, full_name, job_title, monthly_salary, status')
    .order('created_at', { ascending: false });

  if (employerId) {
    query = query.eq('employer_id', employerId);
  }

  const { data: employees, error } = await query;

  if (error) {
    console.error('[GET /api/admin/employees] Supabase error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }

  return NextResponse.json(employees || [], {
    status:  200,
    headers: rateResult.headers,
  });
}