import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { ReportsQuerySchema } from '@/lib/validations/employer-reports';
import { getCurrencyFromCountry } from '@/lib/utils';
import { getEnv } from '@/env';
import { Redis } from '@upstash/redis';

export const runtime = 'nodejs';

function startOf(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOf(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

type DateRange = { from: Date; to: Date; label: string };

function getPeriodRange(period: string, monthParam?: string): DateRange {
  const now = new Date();

  if (monthParam) {
    const [year, month] = monthParam.split('-').map(Number);
    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month, 0);       // last day of the month
    return {
      from: startOf(from),
      to:   endOf(to),
      label: from.toLocaleString('en', { month: 'long', year: 'numeric' }),
    };
  }

  switch (period) {
    case 'this_week': {
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      return { from: startOf(monday), to: endOf(now), label: 'This Week' };
    }
    case 'last_month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to   = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOf(from), to: endOf(to), label: 'Last Month' };
    }
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3);
      const from = new Date(now.getFullYear(), q * 3, 1);
      return { from: startOf(from), to: endOf(now), label: 'This Quarter' };
    }
    case 'this_year': {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from: startOf(from), to: endOf(now), label: 'This Year' };
    }
    default: { // this_month
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        from:  startOf(from),
        to:    endOf(now),
        label: now.toLocaleString('en', { month: 'long', year: 'numeric' }),
      };
    }
  }
}

function getPreviousRange(current: DateRange): DateRange {
  const duration = current.to.getTime() - current.from.getTime();
  const to   = new Date(current.from.getTime() - 1);
  const from = new Date(to.getTime() - duration);
  return { from, to, label: 'Previous Period' };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('[reports] Auth error:', authError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: registrationProfile } = await supabase
    .from('profiles')
    .select('phone_country_code')
    .eq('id', user.id)
    .maybeSingle();

  const registrationCountryCode =
    registrationProfile?.phone_country_code
    ?? (user.user_metadata?.phone_country_code as string | undefined);

  const { searchParams } = new URL(req.url);
  const parsed = ReportsQuerySchema.safeParse({
    period: searchParams.get('period') ?? 'this_month',
    month:  searchParams.get('month') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', detail: parsed.error.issues },
      { status: 422 },
    );
  }

  const { period, month } = parsed.data;
  const range = getPeriodRange(period, month);
  const prevRange = getPreviousRange(range);

  const env = getEnv();
  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  const CACHE_TTL = 15; // 15-second cache — keeps reads fast without staling after disbursements
  const cacheKey = `employer:reports:${user.id}:${period}:${month ?? 'none'}`;

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(`[Reports] Cache hit for ${user.id}`);
      return NextResponse.json(cachedData, { 
        headers: { 'X-Cache': 'HIT' } 
      });
    }
  } catch (cacheError) {
    console.warn('[Reports] Cache check failed:', cacheError);
  }

  let employer: {
    id: string;
    onboarding_id: string | null;
    country: string | null;
    risk_score: number | null;
    risk_rating: string | null;
  } | null = null;
  
  try {
    const { data: liveEmployer, error: employerError } = await supabase
      .from('employers')
      .select('id, onboarding_id, country, risk_score, risk_rating')
      .eq('user_id', user.id)
      .maybeSingle();

    if (employerError) {
      console.error('[reports] Error fetching employer:', employerError);
      return NextResponse.json({ error: 'Failed to fetch employer', detail: employerError.message }, { status: 500 });
    }

    employer = liveEmployer;
  } catch (err) {
    console.error('[reports] Exception fetching employer:', err);
  }

  if (!employer) {
    return NextResponse.json({
        data: {
          period:  { label: range.label, from: range.from.toISOString(), to: range.to.toISOString() },
          currency: getCurrencyFromCountry(registrationCountryCode, 'KES'),
            advances: {
              total: 0, disbursed: 0, pending: 0, denied: 0,
              total_amount: 0, total_fees: 0, avg_amount: 0,
            by_method: { mobile_money: 0, bank_transfer: 0 },
          },
          employees: { total: 0, active: 0, with_advances: 0, utilization_rate: 0 },
          risk_score: null,
          risk_rating: null,
          previous_period: { total_amount: 0, total_fees: 0 },
          monthly_trend: [],
        },
      });
  }

  const employerId = employer.id;
  const onboardingEmployerId = employer.onboarding_id;
  const currency = getCurrencyFromCountry(employer.country ?? registrationCountryCode, 'KES');

  // Resolve all employee IDs for this employer.
  // Primary: employees table (normalized). Fallback: employee_onboarding (legacy).
  // We query by employee_id when fetching advances to bypass the employer_id
  // ambiguity — some advances still carry employer_onboarding.id there.
  let allEmployeeIds: string[] = [];
  let activeCount = 0;

  try {
    const { data: empRows } = await supabase
      .from('employees')
      .select('id, status')
      .eq('employer_id', employerId);

    if (empRows && empRows.length > 0) {
      allEmployeeIds = (empRows as { id: string; status: string }[]).map((e) => e.id);
      activeCount = (empRows as { id: string; status: string }[])
        .filter((e) => e.status === 'Active' || e.status === 'approved').length;
    } else {
      // Fallback: pull from employee_onboarding using both employer IDs
      const onboardingIds = [employerId, onboardingEmployerId].filter(Boolean) as string[];
      const { data: onbRows } = await supabase
        .from('employee_onboarding')
        .select('id, status')
        .in('employer_id', onboardingIds);

      if (onbRows && onbRows.length > 0) {
        allEmployeeIds = (onbRows as { id: string; status: string }[]).map((e) => e.id);
        activeCount = (onbRows as { id: string; status: string }[])
          .filter((e) => e.status === 'Active' || e.status === 'approved').length;
      }
    }
  } catch (err) {
    console.error('[reports] Exception fetching employees:', err);
  }

  // Compute advance summary directly — avoids get_employer_advance_summary RPC which
  // filters by advances.employer_id and misses rows still carrying onboarding IDs.
  const DISBURSED_STATUSES = ['completed', 'repaid'] as const;
  const PENDING_STATUSES   = ['pending', 'approved', 'processing'] as const;
  const DENIED_STATUSES    = ['rejected', 'failed'] as const;

  function computeSummary(rows: Array<{ amount: unknown; fee_amount: unknown; disbursement_method: string | null; status: string; employee_id: string }>) {
    const disbursed = rows.filter((r) => (DISBURSED_STATUSES as readonly string[]).includes(r.status));
    const totalAmount = disbursed.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const totalFees   = disbursed.reduce((s, r) => s + Number(r.fee_amount ?? 0), 0);
    return {
      total_count:                    rows.length,
      disbursed_count:                disbursed.length,
      pending_count:                  rows.filter((r) => (PENDING_STATUSES as readonly string[]).includes(r.status)).length,
      denied_count:                   rows.filter((r) => (DENIED_STATUSES  as readonly string[]).includes(r.status)).length,
      total_amount:                   totalAmount,
      total_fees:                     totalFees,
      avg_amount:                     disbursed.length > 0 ? totalAmount / disbursed.length : 0,
      by_mobile_money:                disbursed.filter((r) => r.disbursement_method === 'mobile_money').length,
      by_bank_transfer:               disbursed.filter((r) => r.disbursement_method !== 'mobile_money' && r.disbursement_method != null).length,
      unique_employees_with_advances: new Set(disbursed.map((r) => r.employee_id).filter(Boolean)).size,
    };
  }

  type AdvanceRow = { amount: unknown; fee_amount: unknown; disbursement_method: string | null; status: string; employee_id: string };

  let summary = computeSummary([]);
  let prevSummary = { total_amount: 0, total_fees: 0 };

  if (allEmployeeIds.length > 0) {
    try {
      const { data: advRows, error: advErr } = await supabase
        .from('advances')
        .select('amount, fee_amount, disbursement_method, status, employee_id')
        .in('employee_id', allEmployeeIds)
        .gte('created_at', range.from.toISOString())
        .lte('created_at', range.to.toISOString());

      if (advErr) {
        console.error('[reports] Error fetching advances (current):', advErr);
      } else {
        summary = computeSummary((advRows ?? []) as AdvanceRow[]);
      }
    } catch (err) {
      console.error('[reports] Exception fetching advances (current):', err);
    }

    try {
      const { data: prevRows, error: prevErr } = await supabase
        .from('advances')
        .select('amount, fee_amount, status, employee_id, disbursement_method')
        .in('employee_id', allEmployeeIds)
        .gte('created_at', prevRange.from.toISOString())
        .lte('created_at', prevRange.to.toISOString());

      if (prevErr) {
        console.error('[reports] Error fetching advances (previous):', prevErr);
      } else {
        const prev = computeSummary((prevRows ?? []) as AdvanceRow[]);
        prevSummary = { total_amount: prev.total_amount, total_fees: prev.total_fees };
      }
    } catch (err) {
      console.error('[reports] Exception fetching advances (previous):', err);
    }
  }

  const totalEmployees   = allEmployeeIds.length;
  const utilizationRate  = totalEmployees > 0
    ? Math.round((summary.unique_employees_with_advances / totalEmployees) * 1000) / 10
    : 0;
  const monthlyTrend: Array<{ label: string; amount: number; count: number }> = [];
  const now = new Date();

  try {
    if (allEmployeeIds.length > 0) {
      const trendFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const { data: trendRows } = await supabase
        .from('advances')
        .select('amount, status, created_at')
        .in('employee_id', allEmployeeIds)
        .in('status', ['completed', 'repaid'])
        .gte('created_at', trendFrom.toISOString());


      const buckets = new Map<string, { amount: number; count: number }>();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        buckets.set(key, { amount: 0, count: 0 });
      }

      for (const row of (trendRows ?? []) as { amount: number | string | null; status: string; created_at: string }[]) {
        const d   = new Date(row.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const b   = buckets.get(key);
        if (b) {
          b.amount += Number(row.amount ?? 0);
          b.count  += 1;
        }
      }

      for (const [key, b] of buckets) {
        const [y, m] = key.split('-').map(Number);
        const label  = new Date(y, m - 1, 1).toLocaleString('en', { month: 'short', year: '2-digit' });
        monthlyTrend.push({ label, amount: b.amount, count: b.count });
      }
    } else {

      for (let i = 5; i >= 0; i--) {
        const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleString('en', { month: 'short', year: '2-digit' });
        monthlyTrend.push({ label, amount: 0, count: 0 });
      }
    }
  } catch (err) {
    console.error('[reports] Error fetching monthly trend:', err);

    for (let i = 5; i >= 0; i--) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('en', { month: 'short', year: '2-digit' });
      monthlyTrend.push({ label, amount: 0, count: 0 });
    }
  }

  let lastSync: { status: string; records_received: number; records_valid: number; created_at: string } | null = null;
  try {
    const { data: syncData } = await supabase
      .from('payroll_sync_logs')
      .select('status, records_received, records_valid, created_at')
      .eq('employer_live_id', employerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    lastSync = syncData;
  } catch (err) {
    console.error('[reports] Error fetching payroll_sync_logs:', err);
  }

  const responseData = {
    data: {
      period: {
        label: range.label,
        from:  range.from.toISOString(),
        to:    range.to.toISOString(),
      },
      currency,
      advances: {
        total:        summary.total_count,
        disbursed:    summary.disbursed_count,
        pending:      summary.pending_count,
        denied:       summary.denied_count,
        total_amount: summary.total_amount,
        total_fees:   summary.total_fees,
        avg_amount:   summary.avg_amount,
        by_method: {
          mobile_money:  summary.by_mobile_money,
          bank_transfer: summary.by_bank_transfer,
        },
      },
      employees: {
        total:            totalEmployees,
        active:           activeCount,
        with_advances:    summary.unique_employees_with_advances,
        utilization_rate: utilizationRate,
      },
      risk_score:  employer.risk_score  != null ? Number(employer.risk_score)  : null,
      risk_rating: employer.risk_rating ?? null,
      previous_period: {
        total_amount: prevSummary.total_amount,
        total_fees:   prevSummary.total_fees,
      },
      monthly_trend: monthlyTrend,
      last_sync: lastSync,
    },
  };

  try {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(responseData));
  } catch (cacheError) {
    console.warn('[Reports] Cache set failed:', cacheError);
  }

  return NextResponse.json(responseData, { 
    headers: { 'X-Cache': 'MISS' } 
  });
  }
