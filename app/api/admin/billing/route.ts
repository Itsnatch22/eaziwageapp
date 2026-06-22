import { NextRequest, NextResponse } from 'next/server';
import { createClient }             from '@supabase/supabase-js';
import { getEnv }                   from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { convertToUSD }             from '@/lib/utils';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  KE: 'KES',
  UG: 'UGX',
  TZ: 'TZS',
  RW: 'RWF',
};

type BillingAdvanceRow = {
  amount?: number | string | null;
  fee_amount?: number | string | null;
  created_at?: string | null;
  status?: string | null;
  employer_id?: string | null;
  employees?: {
    country?: string | null;
  } | null;
};

type EmployerMetadata = {
  credit_limit?: number;
};

function resolveCurrency(country?: string | null): string {
  return COUNTRY_TO_CURRENCY[(country ?? '').toUpperCase()] ?? 'KES';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip         = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-billing:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

  const routeSupabase = await createRouteHandlerClient();
  const { data: { user }, error: authError } = await routeSupabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const adminAccess = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
  if (adminAccess.error || !adminAccess.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const env      = getEnv();
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);

    const { data: exchangeRates } = await supabase
      .from('exchange_rates')
      .select('currency_code, rate_to_usd');

    const rates = (exchangeRates || []).reduce((acc: Record<string, number>, rate) => {
      if (rate.currency_code) acc[rate.currency_code.toUpperCase()] = Number(rate.rate_to_usd ?? 0);
      return acc;
    }, {} as Record<string, number>);

    const { data: advancesData, error: advancesError } = await supabase
      .from('advances')
      .select(`
        amount,
        fee_amount,
        created_at,
        status,
        employer_id,
        employees!advances_employee_id_fkey (
          country
        )
      `)
      .gte('created_at', sixMonthsAgo.toISOString());

    if (advancesError) throw advancesError;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendMap = new Map();

    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = `${months[d.getMonth()]} ${d.getFullYear()}`;
      trendMap.set(label, { label, revenue: 0, disbursed: 0, count: 0 });
    }

    (advancesData as BillingAdvanceRow[] || []).forEach(adv => {
      const d = new Date(adv.created_at!);
      const label = `${months[d.getMonth()]} ${d.getFullYear()}`;
      if (trendMap.has(label)) {
        const stats = trendMap.get(label);
        if (adv.status === 'disbursed') {
          const currency = resolveCurrency(adv.employees?.country);
          stats.revenue  += convertToUSD(Number(adv.fee_amount || 0), currency, rates);
          stats.disbursed += convertToUSD(Number(adv.amount    || 0), currency, rates);
          stats.count    += 1;
        }
      }
    });

    const monthlyTrends = Array.from(trendMap.values()).reverse();

    const { data: totalStats, error: totalError } = await supabase
      .from('advances')
      .select(`
        amount,
        fee_amount,
        employees!advances_employee_id_fkey (
          country
        )
      `)
      .eq('status', 'disbursed');

    if (totalError) throw totalError;

    const cumulativeRevenue = (totalStats as BillingAdvanceRow[] || []).reduce((sum, a) => {
      const currency = resolveCurrency(a.employees?.country);
      return sum + convertToUSD(Number(a.fee_amount || 0), currency, rates);
    }, 0);

    const cumulativeDisbursed = (totalStats as BillingAdvanceRow[] || []).reduce((sum, a) => {
      const currency = resolveCurrency(a.employees?.country);
      return sum + convertToUSD(Number(a.amount || 0), currency, rates);
    }, 0);

    const { data: wallets, error: walletError } = await supabase
      .from('employer_wallets')
      .select('id, balance, arrears_balance, currency, employer_id');

    if (walletError) throw walletError;

    const employerIds = (wallets || []).map(w => w.employer_id);
    const { data: employers, error: empError } = await supabase
      .from('employers')
      .select('id, company_name, metadata')
      .in('id', employerIds);

    if (empError) throw empError;

    const walletHealth = (wallets || []).map(w => {
      const employer    = (employers || []).find(e => e.id === w.employer_id);
      const metadata    = employer?.metadata as EmployerMetadata | undefined;
      const creditLimit = Number(metadata?.credit_limit ?? 1000000);
      const utilization = creditLimit > 0 ? Math.round((Number(w.balance) / creditLimit) * 100) : 0;
      const currency    = w.currency || 'KES';

      return {
        ...w,
        company_name:        employer?.company_name || 'Unknown Employer',
        utilization,
        balance_usd:         convertToUSD(Number(w.balance         || 0), currency, rates),
        arrears_balance_usd: convertToUSD(Number(w.arrears_balance || 0), currency, rates),
      };
    });

    const totalWalletBalance = walletHealth.reduce((sum, w) => sum + Number(w.balance_usd         || 0), 0);
    const totalArrears       = walletHealth.reduce((sum, w) => sum + Number(w.arrears_balance_usd || 0), 0);

    const employerRevenueMap = new Map<string, number>();
    (advancesData as BillingAdvanceRow[] || []).forEach(adv => {
      const employerId = adv.employer_id;
      if (employerId && adv.status === 'disbursed') {
        const currency = resolveCurrency(adv.employees?.country);
        const current  = employerRevenueMap.get(employerId) || 0;
        employerRevenueMap.set(employerId, current + convertToUSD(Number(adv.fee_amount || 0), currency, rates));
      }
    });

    const topRevenueGenerators = Array.from(employerRevenueMap.entries())
      .map(([id, revenue]) => ({
        id,
        revenue,
        company_name: employers?.find(e => e.id === id)?.company_name || 'Unknown',
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return NextResponse.json({
      summary: {
        total_revenue:           cumulativeRevenue,
        total_disbursed:         cumulativeDisbursed,
        total_wallet_balance:    totalWalletBalance,
        total_arrears:           totalArrears,
        top_revenue_generators:  topRevenueGenerators,
      },
      monthlyTrends,
      walletHealth,
    }, { status: 200, headers: rateResult.headers });

  } catch (error) {
    console.error('[GET /api/admin/billing] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing stats.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}