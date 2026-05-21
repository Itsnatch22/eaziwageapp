import { NextRequest, NextResponse } from 'next/server';
import { createClient }             from '@supabase/supabase-js';
import { getEnv }                   from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';

type BillingAdvanceRow = {
  amount?: number | string | null;
  fee_amount?: number | string | null;
  created_at?: string | null;
  status?: string | null;
  employer_id?: string | null;
};

type EmployerMetadata = {
  credit_limit?: number;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip         = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-billing:${ip}`);

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
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);

    const { data: advancesData, error: advancesError } = await supabase
      .from('advances')
      .select('amount, fee_amount, created_at, status, employer_id')
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

    (advancesData || []).forEach(adv => {
      const d = new Date(adv.created_at);
      const label = `${months[d.getMonth()]} ${d.getFullYear()}`;
      if (trendMap.has(label)) {
        const stats = trendMap.get(label);
        if (adv.status === 'disbursed') {
          stats.revenue += Number(adv.fee_amount || 0);
          stats.disbursed += Number(adv.amount || 0);
          stats.count += 1;
        }
      }
    });

    const monthlyTrends = Array.from(trendMap.values()).reverse();

    const { data: totalStats, error: totalError } = await supabase
      .from('advances')
      .select('amount, fee_amount')
      .eq('status', 'disbursed');

    if (totalError) throw totalError;

    const cumulativeRevenue = (totalStats || []).reduce((sum, a) => sum + Number(a.fee_amount || 0), 0);
    const cumulativeDisbursed = (totalStats || []).reduce((sum, a) => sum + Number(a.amount || 0), 0);

    const { data: wallets, error: walletError } = await supabase
      .from('employer_wallets')
      .select(`
        id,
        balance,
        arrears_balance,
        currency,
        employer_id
      `);

    if (walletError) throw walletError;

    // Fetch employer names and credit limits for wallets
    const employerIds = (wallets || []).map(w => w.employer_id);
    const { data: employers, error: empError } = await supabase
      .from('employers')
      .select('id, company_name, metadata')
      .in('id', employerIds);

    if (empError) throw empError;

    const walletHealth = (wallets || []).map(w => {
      const employer = (employers || []).find(e => e.id === w.employer_id);
      const metadata = employer?.metadata as EmployerMetadata | undefined;
      const creditLimit = Number(metadata?.credit_limit ?? 1000000);
      const utilization = creditLimit > 0 ? Math.round((Number(w.balance) / creditLimit) * 100) : 0;

      return {
        ...w,
        company_name: employer?.company_name || 'Unknown Employer',
        utilization,
      };
    });

    const totalWalletBalance = walletHealth.reduce((sum, w) => sum + Number(w.balance || 0), 0);
    const totalArrears = walletHealth.reduce((sum, w) => sum + Number(w.arrears_balance || 0), 0);

    // 4. Top Revenue Generators
    const employerRevenueMap = new Map<string, number>();
    (advancesData || []).forEach((adv: BillingAdvanceRow) => {
      const employerId = adv.employer_id;
      if (employerId && adv.status === 'disbursed') {
        const current = employerRevenueMap.get(employerId) || 0;
        employerRevenueMap.set(employerId, current + Number(adv.fee_amount || 0));
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
        total_revenue: cumulativeRevenue,
        total_disbursed: cumulativeDisbursed,
        total_wallet_balance: totalWalletBalance,
        total_arrears: totalArrears,
        top_revenue_generators: topRevenueGenerators,
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
