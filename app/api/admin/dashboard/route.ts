import { NextRequest, NextResponse } from 'next/server';
import { createClient }             from '@supabase/supabase-js';
import { getEnv }                   from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { convertToUSD }             from '@/lib/utils';
import { Redis }                   from '@upstash/redis';

type AdvanceAmountRow = {
  amount: number | string | null;
  fee_amount: number | string | null;
  employee_onboarding?: {
    currency?: string | null;
  };
};

type EmployerRiskRow = {
  risk_score: number | null;
};

type ApiHealthRow = {
  name: string | null;
  status: string | null;
  latency_ms: number | null;
  uptime_percent: number | null;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip         = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-dashboard:${ip}`);

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

  const CACHE_TTL = 300; 
  const cacheKey = 'admin:dashboard:stats';

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData && typeof cachedData === 'object') {
      console.log('[Dashboard] Cache hit - returning cached data');
      return NextResponse.json(cachedData, { 
        status: 200, 
        headers: { 
          ...rateResult.headers,
          'X-Cache': 'HIT'
        } 
      });
    }
  } catch (cacheError) {
    console.warn('[Dashboard] Cache check failed:', cacheError);
  }

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    
    const { count: riskPending } = await supabase
      .from('review_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: bankPending } = await supabase
      .from('bank_change_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const totalPendingReviews = (riskPending || 0) + (bankPending || 0);

    const { count: activeFraudAlerts } = await supabase
      .from('fraud_alerts')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'resolved');

    const { data: latestFraudAlerts } = await supabase
      .from('fraud_alerts')
      .select('id,title,description,severity,created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    const { count: employerTotal } = await supabase
      .from('employers')
      .select('id', { count: 'exact', head: true });

    const { count: employerActive } = await supabase
      .from('employers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved');

    const { count: employerRejected } = await supabase
      .from('employers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'rejected');

    const { count: employerPending } = await supabase
      .from('employer_onboarding')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: employeeTotal } = await supabase
      .from('employee_onboarding')
      .select('id', { count: 'exact', head: true });

    const { count: employeeActive } = await supabase
      .from('employee_onboarding')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved');

    const { count: employeeKYCPending } = await supabase
      .from('employee_kyc_documents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: exchangeRates } = await supabase
      .from('exchange_rates')
      .select('currency_code, rate_to_usd');

    const rates = (exchangeRates || []).reduce((acc: Record<string, number>, rate) => {
      if (rate.currency_code) acc[rate.currency_code.toUpperCase()] = Number(rate.rate_to_usd ?? 0);
      return acc;
    }, {} as Record<string, number>);

    const [
      { count: employerThisMonth },
      { count: employeeThisMonth },
      { count: advanceTotal },
      { count: advancePending },
      { data: advanceAmounts },
      { count: pendingReconciliation },
      { data: monthlyAdvances },
      { data: employerRisks },
      { data: apiHealthData },
    ] = await Promise.all([
      supabase
        .from('employers')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfMonth),
      supabase
        .from('employee_onboarding')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfMonth),
      supabase
        .from('advances')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('advances')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('advances')
        .select('amount, fee_amount, employee_onboarding(currency)')
        .eq('status', 'disbursed'),
      supabase
        .from('advances')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'disbursed'),
      supabase
        .from('advances')
        .select('amount, fee_amount, employee_onboarding(currency)')
        .gte('created_at', startOfMonth)
        .eq('status', 'disbursed'),
      supabase
        .from('employers')
        .select('risk_score')
        .not('risk_score', 'is', null),
      supabase
        .from('api_health')
        .select('name, status, latency_ms, uptime_percent'),
    ]);

    const employerTrendValue = employerTotal ? Math.round(((employerThisMonth || 0) / employerTotal) * 100) : 0;
    const employerTrend = `+${employerTrendValue}%`;

    const employeeTrendValue = employeeTotal ? Math.round(((employeeThisMonth || 0) / employeeTotal) * 100) : 0;
    const employeeTrend = `+${employeeTrendValue}%`;

    const disbursedAdvances = (advanceAmounts || []) as AdvanceAmountRow[];
    const monthDisbursedAdvances = (monthlyAdvances || []) as AdvanceAmountRow[];
    const totalDisbursed = disbursedAdvances.reduce((sum, row) => sum + convertToUSD(
      Number(row.amount || 0),
      row.employee_onboarding?.currency || 'KES',
      rates,
    ), 0);
    const totalFees = disbursedAdvances.reduce((sum, row) => sum + convertToUSD(
      Number(row.fee_amount || 0),
      row.employee_onboarding?.currency || 'KES',
      rates,
    ), 0);
    const monthlyDisbursed = monthDisbursedAdvances.reduce((sum, row) => sum + convertToUSD(
      Number(row.amount || 0),
      row.employee_onboarding?.currency || 'KES',
      rates,
    ), 0);
    const monthlyFees = monthDisbursedAdvances.reduce((sum, row) => sum + convertToUSD(
      Number(row.fee_amount || 0),
      row.employee_onboarding?.currency || 'KES',
      rates,
    ), 0);

    const avgEmployerScore = employerRisks && employerRisks.length > 0
      ? ((employerRisks as EmployerRiskRow[]).reduce((sum, employer) => sum + Number(employer.risk_score || 0), 0) / employerRisks.length)
      : 3.5;

    const apiHealthStats = ((apiHealthData || []) as ApiHealthRow[]).reduce((stats: Record<string, ApiHealthRow>, health) => {
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

    const responseData = {
      employers: {
        total:  employerTotal || 0,
        active: employerActive || 0,
        rejected: employerRejected || 0,
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
      pending_reviews: totalPendingReviews,
      suspicious_activity: {
        total_open: activeFraudAlerts || 0,
        alerts: latestFraudAlerts || [],
      },
      pending_reconciliation: pendingReconciliation || 0,
      monthly: {
        disbursed:     monthlyDisbursed,
        advance_count: monthDisbursedAdvances.length,
        fees:          monthlyFees,
      },
      risk: {
        avg_employer_score: avgEmployerScore,
      },
      api_health: apiHealthStats,
    };

    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(responseData));
      console.log('[Dashboard] Data cached successfully');
    } catch (cacheError) {
      console.warn('[Dashboard] Failed to cache data:', cacheError);
    }

    return NextResponse.json(responseData, { 
      status: 200, 
      headers: { 
        ...rateResult.headers,
        'X-Cache': 'MISS'
      } 
    });
  } catch (error) {
    console.error('[GET /api/admin/dashboard] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-dashboard-cache:${ip}`);

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

  const cacheKey = 'admin:dashboard:stats';

  try {
    await redis.del(cacheKey);
    console.log('[Dashboard] Cache invalidated successfully');
    
    return NextResponse.json(
      { success: true, message: 'Dashboard cache cleared successfully' },
      { status: 200, headers: rateResult.headers }
    );
  } catch (error) {
    console.error('[Dashboard] Cache invalidation failed:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache.', code: 'CACHE_ERROR' },
      { status: 500, headers: rateResult.headers }
    );
  }
}
