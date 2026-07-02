import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { convertToUSD, getCurrencyFromCountry } from '@/lib/utils';
import { requireAdmin } from '@/lib/server/admin-auth';
import { DISBURSED_STATUSES } from '@/lib/constants/advance-status';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-reconciliation:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

  const env = getEnv();
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const [onboardingRes, liveRes] = await Promise.all([
      supabase
        .from('employer_onboarding')
        .select('id, company_name, status'),
      supabase
        .from('employers')
        .select('id, onboarding_id')
    ]);

    // Map: employers.id → employer_onboarding.id (for advances that reference the live employers table)
    const liveToOnboardingId: Record<string, string> = {};
    (liveRes.data || []).forEach(e => {
      if (e.id && e.onboarding_id) liveToOnboardingId[e.id] = e.onboarding_id;
    });

    const byEmployer: Record<string, {
      employer_id: string;
      employer_name: string;
      status: string;
      total_advances: number;
      total_amount: number;
      total_fees: number;
      recouped: number;
      pending_recoupment: number;
      advances: Array<{
        id: string;
        reference: string;
        employee_name: string;
        amount: number;
        status: 'repaid' | 'pending';
        created_at: string;
      }>;
    }> = {};

    // Seed from employer_onboarding only — single source of truth per company
    (onboardingRes.data || []).forEach(emp => {
      byEmployer[emp.id] = {
        employer_id: emp.id,
        employer_name: emp.company_name || 'Unknown Employer',
        status: emp.status,
        total_advances: 0,
        total_amount: 0,
        total_fees: 0,
        recouped: 0,
        pending_recoupment: 0,
        advances: [],
      };
    });

    const { data: exchangeRates } = await supabase
      .from('exchange_rates')
      .select('currency_code, rate_to_usd');

    const rates = (exchangeRates || []).reduce((acc: Record<string, number>, rate) => {
      if (rate.currency_code) acc[rate.currency_code.toUpperCase()] = Number(rate.rate_to_usd ?? 0);
      return acc;
    }, {} as Record<string, number>);

    const { data: advances, error: advError } = await supabase
  .from('advances')
  .select(`
    id,
    amount,
    fee_amount,
    status,
    reference,
    created_at,
    employer_id,
    employee_id,
    employees!advances_employee_id_fkey(country)
  `)
  .in('status', DISBURSED_STATUSES);

if (advError) throw advError;

    if (advError) throw advError;

    let totalDisbursed = 0;
    let totalFees = 0;
    let totalRecouped = 0;
    let pendingRecoupment = 0;

    type AdvanceRow = {
  id?: string;
  amount?: number | string | null;
  fee_amount?: number | string | null;
  status?: string | null;
  reference?: string | null;
  created_at?: string | null;
  employer_id?: string | null;
  employee_id?: string | null;
  employees?: {
    country?: string | null;
  };
};
    type ProfileRow = { id: string; full_name?: string | null } | null;

    const advancesRows = (advances || []) as AdvanceRow[];

    const employeeIds = Array.from(new Set(advancesRows.map((a) => a.employee_id).filter(Boolean))) as string[];
    let profileMap: Record<string, string> = {};
    if (employeeIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', employeeIds);

      profileMap = (profiles || []).reduce((acc: Record<string, string>, p: ProfileRow) => {
        if (p && p.id) acc[p.id] = p.full_name || 'Unknown Employee';
        return acc;
      }, {} as Record<string, string>);
    }

    advancesRows.forEach((advRow) => {
      const rawEmployerId = (advRow.employer_id || '') as string;
      // Resolve live employers.id → employer_onboarding.id if needed
      const employerId = liveToOnboardingId[rawEmployerId] ?? rawEmployerId;
      if (!byEmployer[employerId]) {
        byEmployer[employerId] = {
          employer_id: employerId,
          employer_name: 'Unknown Employer (Inactive)',
          status: 'inactive',
          total_advances: 0,
          total_amount: 0,
          total_fees: 0,
          recouped: 0,
          pending_recoupment: 0,
          advances: [],
        };
      }

      const currency = getCurrencyFromCountry(advRow.employees?.country, 'KES');
      const amount = convertToUSD(Number(advRow.amount || 0), currency, rates);
      const fee = convertToUSD(Number(advRow.fee_amount || 0), currency, rates);
      const total = amount + fee;

      byEmployer[employerId].total_advances += 1;
      byEmployer[employerId].total_amount += amount;
      byEmployer[employerId].total_fees += fee;

      if (advRow.status === 'repaid') {
        byEmployer[employerId].recouped += total;
        totalRecouped += total;
      } else {
        byEmployer[employerId].pending_recoupment += total;
        pendingRecoupment += total;
      }

      totalDisbursed += amount;
      totalFees += fee;

      const employeeName = (advRow.employee_id && profileMap[advRow.employee_id]) || 'Unknown Employee';

      byEmployer[employerId].advances.push({
        id: advRow.id || '',
        reference: advRow.reference || '',
        employee_name: employeeName || 'Unknown Employee',
        amount: total,
        status: advRow.status === 'repaid' ? 'repaid' : 'pending',
        created_at: advRow.created_at || '',
      });
    });

    const result = {
      summary: {
        total_employers: Object.keys(byEmployer).length,
        total_disbursed: totalDisbursed,
        total_fees: totalFees,
        total_recouped: totalRecouped,
        pending_recoupment: pendingRecoupment,
      },
      by_employer: Object.values(byEmployer).sort((a, b) => {
        if (b.total_amount !== a.total_amount) return b.total_amount - a.total_amount;
        return a.employer_name.localeCompare(b.employer_name);
      }),
    };

    return NextResponse.json(result, { status: 200, headers: rateResult.headers });
  } catch (error) {
    console.error('[GET /api/admin/reconciliation] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation data.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}
