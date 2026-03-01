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

    // ── 5b. Fetch trends ──────────────────────────────────────────────────────
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count: employerThisMonth } = await supabase
      .from('employers')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfMonth);
    
    const employerTrendValue = employerTotal ? Math.round(((employerThisMonth || 0) / employerTotal) * 100) : 0;
    const employerTrend = `+${employerTrendValue}%`;

    const { count: employeeThisMonth } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfMonth);
    
    const employeeTrendValue = employeeTotal ? Math.round(((employeeThisMonth || 0) / employeeTotal) * 100) : 0;
    const employeeTrend = `+${employeeTrendValue}%`;

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

    const { count: pendingReconciliation } = await supabase
      .from('advances')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'disbursed');

    // ── 7. Monthly stats ───────────────────────────────────────────────────────

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

    const { count: riskFactorsCount } = await supabase
      .from('employer_risk_factors')
      .select('employer_id', { count: 'exact', head: true });
    
    const pendingReviews = Math.max(0, (employerTotal || 0) - (riskFactorsCount || 0));

    // ── 9. Fetch API health 
    const { data: apiHealthData } = await supabase
      .from('api_health')
      .select('name, status, latency_ms, uptime_percent');

    const apiHealth = apiHealthData || [];

    const apiHealthStats = apiHealth.reduce((stats: Record<string, any>, health: any) => {
      if (health.name) {
        stats[health.name] = {
          name: health.name,
          status: health.status,
          latency_ms: health.latency_ms,
          uptime_percent: health.uptime_percent,
        };
      }
      return stats;
    }, {});


    // ── 10. Build response ─────────────────────────────────────────────────────
    return NextResponse.json(
      {
        employers: {
          total:  employerTotal || 0,
          active: employerActive || 0,
          trend: employerTrend,
          trendUp: employerTrendValue >= 0,
        },
        employees: {
          total:  employeeTotal || 0,
          active: employeeActive || 0,
          trend: employeeTrend,
          trendUp: employeeTrendValue >= 0,
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
        pending_reviews: pendingReviews,
        pending_reconciliation: pendingReconciliation || 0,
        monthly: {
          disbursed:     monthlyDisbursed,
          advance_count: (monthlyAdvances || []).length,
          fees:          monthlyFees,
        },
        risk: {
          avg_employer_score: avgEmployerScore,
        },
        api_health: apiHealthStats,
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