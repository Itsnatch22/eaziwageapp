import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { OUTSTANDING_STATUSES } from '@/lib/constants/advance-status';

export const runtime = 'nodejs';

function getMonthRange(monthParam: string | null): { from: string; to: string; key: string } {
  const now = new Date();
  const [year, month] = monthParam?.split('-').map(Number) ?? [now.getFullYear(), now.getMonth() + 1];
  const fromDate = new Date(year, month - 1, 1);
  const toDate = new Date(year, month, 0, 23, 59, 59, 999);
  const key = `${year}-${String(month).padStart(2, '0')}`;
  return { from: fromDate.toISOString(), to: toDate.toISOString(), key };
}

interface AdvanceAmountRow {
  amount: number | string | null;
}

export async function GET(req: Request) {
  console.log('[credit-overview] === START ===');
  
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('[credit-overview] Auth error:', authError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[credit-overview] User authenticated:', user.id);

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const range = getMonthRange(month);
  console.log('[credit-overview] Month range:', range);

  console.log('[credit-overview] Fetching employer for user:', user.id);
  const { data: employer, error: employerError } = await supabase
    .from('employers')
    .select('id, onboarding_id, credit_limit')
    .eq('user_id', user.id)
    .maybeSingle();

  if (employerError) {
    console.error('[credit-overview] ❌ Employer query error:', employerError);
    return NextResponse.json({ error: 'Failed to fetch employer record' }, { status: 500 });
  }

  if (!employer) {
    console.log('[credit-overview] No employer found, returning empty stats');
    return NextResponse.json({
      month: range.key,
      company_credit_limit: 0,
      total_outstanding_credit: 0,
      month_disbursed_amount: 0,
      remaining_monthly_limit: 0,
      available_company_credit: 0,
      utilization_percent: 0,
    });
  }

  console.log('[credit-overview] ✓ Employer found:', employer.id);

  // Admin-configured monthly cap lives on employers.credit_limit — NOT
  // employer_wallets (that table has no balance column; it tracks
  // total_advanced/outstanding_liability, a different concept).
  const companyCreditLimit = Number(employer.credit_limit ?? 0);
  console.log('[credit-overview] ✓ Configured credit limit:', companyCreditLimit);

  console.log('[credit-overview] Fetching employees for employer:', employer.id);
  const { data: employees, error: employeeError } = await supabase
    .from('employees')
    .select('id')
    .eq('employer_id', employer.id)
    .eq('status', 'Active');

  if (employeeError) {
    console.error('[credit-overview] Employee query error:', employeeError);
    return NextResponse.json({ error: 'Failed to fetch employees for employer' }, { status: 500 });
  }

  const employeeIds = (employees ?? []).map((e) => e.id);
  console.log('[credit-overview] ✓ Found employees:', employeeIds.length);

  if (employeeIds.length === 0) {
    console.log('[credit-overview] No employees, returning empty stats');
    return NextResponse.json({
      month: range.key,
      company_credit_limit: companyCreditLimit,
      total_outstanding_credit: 0,
      month_disbursed_amount: 0,
      remaining_monthly_limit: companyCreditLimit,
      available_company_credit: companyCreditLimit,
      utilization_percent: 0,
    });
  }

  console.log('[credit-overview] Fetching advances for', employeeIds.length, 'employees');
  console.log('[credit-overview] Date range:', range.from, 'to', range.to);

  // "Outstanding Credit" reads from employer_wallets.outstanding_liability instead of
  // re-summing the advances table. That column is the webhook-maintained ledger
  // (updated in near-real-time as DusuPay settles disbursements/repayments — see
  // app/api/webhook/dusupay/route.ts) and is the same figure the wallet page's
  // "Arrears Balance" already uses. A live SUM over advances.status here would drift
  // from it (e.g. it'd miss advances still in 'processing' that the ledger already
  // counted at disbursement time) and give the impression of two disagreeing numbers
  // for the same thing.
  const [walletQuery, monthQuery] = await Promise.all([
    supabase
      .from('employer_wallets')
      .select('outstanding_liability')
      .eq('employer_id', employer.id)
      .maybeSingle(),
    supabase
      .from('advances')
      .select('amount')
      .in('employee_id', employeeIds)
      .in('status', ['approved', ...OUTSTANDING_STATUSES])
      .gte('created_at', range.from)
      .lte('created_at', range.to),
  ]);

  if (walletQuery.error) {
    console.error('[credit-overview] Wallet query error:', walletQuery.error);
    return NextResponse.json({ error: 'Failed to fetch employer wallet' }, { status: 500 });
  }

  console.log('[credit-overview] ✓ Outstanding liability:', walletQuery.data?.outstanding_liability ?? 0);

  if (monthQuery.error) {
    console.error('[credit-overview] Month advances query error:', monthQuery.error);
    return NextResponse.json({ error: 'Failed to fetch advances for month range' }, { status: 500 });
  }

  console.log('[credit-overview] Month advances found:', monthQuery.data?.length ?? 0);

  const sumAmounts = (rows: AdvanceAmountRow[] | null) => (rows ?? []).reduce((sum, row) => {
    return sum + Number(row.amount ?? 0);
  }, 0);

  const totalOutstandingCredit = Number(walletQuery.data?.outstanding_liability ?? 0);
  const monthDisbursedAmount = sumAmounts((monthQuery.data ?? []) as AdvanceAmountRow[]);
  const remainingMonthlyLimit = Math.max(0, companyCreditLimit - monthDisbursedAmount);
  const availableCompanyCredit = Math.max(0, companyCreditLimit - totalOutstandingCredit);
  const utilizationPercent = companyCreditLimit > 0
    ? Math.round((monthDisbursedAmount / companyCreditLimit) * 1000) / 10
    : 0;

  console.log('[credit-overview]  Calculations complete:', {
    companyCreditLimit,
    totalOutstandingCredit,
    monthDisbursedAmount,
    remainingMonthlyLimit,
    availableCompanyCredit,
    utilizationPercent,
  });

  console.log('[credit-overview] === SUCCESS ===');

  return NextResponse.json({
    month: range.key,
    company_credit_limit: companyCreditLimit,
    total_outstanding_credit: totalOutstandingCredit,
    month_disbursed_amount: monthDisbursedAmount,
    remaining_monthly_limit: remainingMonthlyLimit,
    available_company_credit: availableCompanyCredit,
    utilization_percent: utilizationPercent,
  });
}
