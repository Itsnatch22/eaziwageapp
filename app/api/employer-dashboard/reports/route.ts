import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { ReportsQuerySchema } from '@/lib/validations/employer-reports';

export const runtime = 'nodejs';

// ─── Date helpers ─────────────────────────────────────────────────────────────

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
type EmployeeStatus = 'approved' | 'pending' | 'rejected' | 'inactive' | 'suspended' | string;
type AdvanceStatus = 'disbursed' | 'approved' | 'pending' | 'rejected' | string;
type DisbursementMethod = 'mobile_money' | 'bank_transfer' | string;

interface EmployeeRow {
  id: string;
  status: EmployeeStatus;
}

interface AdvanceRow {
  id: string;
  employee_id: string;
  amount: number | string | null;
  fee_amount: number | string | null;
  status: AdvanceStatus;
  disbursement_method: DisbursementMethod | null;
  created_at: string;
}

interface PrevAdvanceRow {
  amount: number | string | null;
  fee_amount: number | string | null;
  status: AdvanceStatus;
}

interface TrendRow {
  amount: number | string | null;
  created_at: string;
}

function getPeriodRange(period: string, monthParam?: string): DateRange {
  const now = new Date();

  // Explicit month override: YYYY-MM
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

/** Returns the range immediately preceding the given range (equal duration). */
function getPreviousRange(current: DateRange): DateRange {
  const duration = current.to.getTime() - current.from.getTime();
  const to   = new Date(current.from.getTime() - 1);
  const from = new Date(to.getTime() - duration);
  return { from, to, label: 'Previous Period' };
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  // ── Auth ────────────────────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse & validate query params ──────────────────────────────────────────
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

  // ── Resolve employer ────────────────────────────────────────────────────────
  const { data: employer, error: employerError } = await supabase
    .from('employer_onboarding')
    .select('id, risk_score, risk_rating')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (employerError) {
    return NextResponse.json({ error: employerError.message }, { status: 500 });
  }

  if (!employer) {
    // Graceful empty state — employer not yet onboarded
    return NextResponse.json({
      data: {
        period:  { label: range.label, from: range.from.toISOString(), to: range.to.toISOString() },
        advances: {
          total: 0, disbursed: 0, pending: 0, rejected: 0,
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

  // ── Fetch employees for this employer ───────────────────────────────────────
  const { data: employeeRows, error: empErr } = await supabase
    .from('employee_onboarding')
    .select('id, status')
    .eq('employer_id', employerId);

  if (empErr) {
    return NextResponse.json({ error: empErr.message }, { status: 500 });
  }

  const typedEmployees = (employeeRows ?? []) as EmployeeRow[];
  const allEmployeeIds = typedEmployees.map((e) => e.id);
  const activeCount = typedEmployees.filter((e) => e.status === 'approved').length;

  // ── Fetch advances (current period) ────────────────────────────────────────
  const { data: advances, error: advErr } = allEmployeeIds.length > 0
    ? await supabase
        .from('advances')
        .select('id, employee_id, amount, fee_amount, status, disbursement_method, created_at')
        .in('employee_id', allEmployeeIds)
        .gte('created_at', range.from.toISOString())
        .lte('created_at', range.to.toISOString())
    : { data: [] as AdvanceRow[], error: null };

  if (advErr) {
    return NextResponse.json({ error: advErr.message }, { status: 500 });
  }

  // ── Fetch advances (previous period for % change) ──────────────────────────
  const { data: prevAdvances } = allEmployeeIds.length > 0
    ? await supabase
        .from('advances')
        .select('amount, fee_amount, status')
        .in('employee_id', allEmployeeIds)
        .in('status', ['disbursed', 'approved'])
        .gte('created_at', prevRange.from.toISOString())
        .lte('created_at', prevRange.to.toISOString())
    : { data: [] as PrevAdvanceRow[] };

  // ── Compute advance summary ─────────────────────────────────────────────────
  const all = (advances ?? []) as AdvanceRow[];
  const disbursed = all.filter((a) => a.status === 'disbursed' || a.status === 'approved');
  const pending = all.filter((a) => a.status === 'pending');
  const rejected = all.filter((a) => a.status === 'rejected');

  const totalAmount = disbursed.reduce((s, a) => s + Number(a.amount ?? 0), 0);
  const totalFees = disbursed.reduce((s, a) => s + Number(a.fee_amount ?? 0), 0);
  const avgAmount = disbursed.length > 0 ? totalAmount / disbursed.length : 0;

  const byMobileMoney = all.filter((a) => a.disbursement_method === 'mobile_money').length;
  const byBankTransfer = all.filter((a) => a.disbursement_method === 'bank_transfer').length;

  // ── Previous period totals ──────────────────────────────────────────────────
  const prevAll = (prevAdvances ?? []) as PrevAdvanceRow[];
  const prevTotalAmount = prevAll.reduce((s, a) => s + Number(a.amount ?? 0), 0);
  const prevTotalFees = prevAll.reduce((s, a) => s + Number(a.fee_amount ?? 0), 0);

  // ── Employee utilization ────────────────────────────────────────────────────
  const uniqueEmployeesWithAdvances = new Set(all.map((a) => a.employee_id)).size;
  const totalEmployees   = allEmployeeIds.length;
  const utilizationRate  = totalEmployees > 0
    ? Math.round((uniqueEmployeesWithAdvances / totalEmployees) * 1000) / 10
    : 0;

  // ── Monthly trend (last 6 calendar months) ─────────────────────────────────
  const monthlyTrend: Array<{ label: string; amount: number; count: number }> = [];
  const now = new Date();

  if (allEmployeeIds.length > 0) {
    const trendFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const { data: trendRows } = await supabase
      .from('advances')
      .select('amount, status, created_at')
      .in('employee_id', allEmployeeIds)
      .in('status', ['disbursed', 'approved'])
      .gte('created_at', trendFrom.toISOString());

    // Bucket by month
    const buckets = new Map<string, { amount: number; count: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, { amount: 0, count: 0 });
    }

    for (const row of (trendRows ?? []) as TrendRow[]) {
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
    // No employees — return 6 empty buckets
    for (let i = 5; i >= 0; i--) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('en', { month: 'short', year: '2-digit' });
      monthlyTrend.push({ label, amount: 0, count: 0 });
    }
  }

  // ── Fetch Last Sync Log ───────────────────────────────────────────────────
  const { data: lastSync } = await supabase
    .from('payroll_sync_logs')
    .select('status, records_received, records_valid, created_at')
    .eq('employer_id', employerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // ── Build response ──────────────────────────────────────────────────────────
  return NextResponse.json({
    data: {
      period: {
        label: range.label,
        from:  range.from.toISOString(),
        to:    range.to.toISOString(),
      },
      advances: {
        total:        all.length,
        disbursed:    disbursed.length,
        pending:      pending.length,
        rejected:     rejected.length,
        total_amount: totalAmount,
        total_fees:   totalFees,
        avg_amount:   avgAmount,
        by_method: {
          mobile_money:  byMobileMoney,
          bank_transfer: byBankTransfer,
        },
      },
      employees: {
        total:            totalEmployees,
        active:           activeCount,
        with_advances:    uniqueEmployeesWithAdvances,
        utilization_rate: utilizationRate,
      },
      risk_score:  employer.risk_score  != null ? Number(employer.risk_score)  : null,
      risk_rating: employer.risk_rating ?? null,
      previous_period: {
        total_amount: prevTotalAmount,
        total_fees:   prevTotalFees,
      },
      monthly_trend: monthlyTrend,
      last_sync: lastSync,
    },
  });
}
