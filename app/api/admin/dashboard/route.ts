import { NextRequest, NextResponse } from 'next/server';
import { createClient }             from '@supabase/supabase-js';
import { getEnv }                   from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── 1. Rate-limit ──────────────────────────────────────────────────────────
  const ip         = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-dashboard:${ip}`);

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

  try {
    // ── 4. Fetch employer stats ───────────────────────────────────────────────
    const { count: employerTotal } = await supabase
      .from('employers')
      .select('id', { count: 'exact', head: true });

    const { count: employerActive } = await supabase
      .from('employers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved');

    const { count: employerPending } = await supabase
      .from('employers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    // ── 5. Fetch employee stats ───────────────────────────────────────────────
    const { count: employeeTotal } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true });

    const { count: employeeActive } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved');

    const { count: employeeKYCPending } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .in('kyc_status', ['submitted', 'pending']);

    // ── 6. Fetch advance stats ────────────────────────────────────────────────
    const { count: advanceTotal } = await supabase
      .from('advances')
      .select('id', { count: 'exact', head: true });

    const { count: advancePending } = await supabase
      .from('advances')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { data: advanceAmounts } = await supabase
      .from('advances')
      .select('amount, fee_amount')
      .eq('status', 'disbursed');

    const totalDisbursed = (advanceAmounts || []).reduce((sum, a) => sum + (a.amount || 0), 0);
    const totalFees      = (advanceAmounts || []).reduce((sum, a) => sum + (a.fee_amount || 0), 0);

    // ── 7. Monthly stats ───────────────────────────────────────────────────────
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: monthlyAdvances } = await supabase
      .from('advances')
      .select('amount, fee_amount')
      .gte('created_at', startOfMonth)
      .eq('status', 'disbursed');

    const monthlyDisbursed = (monthlyAdvances || []).reduce((sum, a) => sum + (a.amount || 0), 0);
    const monthlyFees      = (monthlyAdvances || []).reduce((sum, a) => sum + (a.fee_amount || 0), 0);

    // ── 8. Risk stats ──────────────────────────────────────────────────────────
    const { data: employerRisks } = await supabase
      .from('employers')
      .select('risk_score')
      .not('risk_score', 'is', null);

    const avgEmployerScore = employerRisks && employerRisks.length > 0
      ? employerRisks.reduce((sum, e) => sum + (e.risk_score || 0), 0) / employerRisks.length
      : 3.5;

    // ── 9. Mock API health (replace with actual monitoring) ───────────────────
    const apiHealth = {
      mpesa_integration: { status: 'healthy', latency_ms: 120, uptime_percent: 99.8 },
      airtel_money:      { status: 'healthy', latency_ms: 135, uptime_percent: 99.5 },
      bank_integration:  { status: 'healthy', latency_ms: 200, uptime_percent: 98.9 },
      payroll_sync:      { status: 'healthy', latency_ms: 180, uptime_percent: 99.2 },
    };

    // ── 10. Build response ─────────────────────────────────────────────────────
    return NextResponse.json(
      {
        employers: {
          total:  employerTotal || 0,
          active: employerActive || 0,
        },
        employees: {
          total:  employeeTotal || 0,
          active: employeeActive || 0,
        },
        advances: {
          total_count:     advanceTotal || 0,
          pending_count:   advancePending || 0,
          total_disbursed: totalDisbursed,
          total_fees:      totalFees,
        },
        kyc_pending: {
          employers: employerPending || 0,
          employees: employeeKYCPending || 0,
        },
        pending_reviews: 0, // TODO: Implement risk review queue
        monthly: {
          disbursed:     monthlyDisbursed,
          advance_count: (monthlyAdvances || []).length,
          fees:          monthlyFees,
        },
        risk: {
          avg_employer_score: avgEmployerScore,
        },
        api_health: apiHealth,
      },
      { status: 200, headers: rateResult.headers },
    );
  } catch (error) {
    console.error('[GET /api/admin/dashboard] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}