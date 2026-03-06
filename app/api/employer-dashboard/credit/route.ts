import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';

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

  // Step 1: Fetch employer
  console.log('[credit-overview] Fetching employer for user:', user.id);
  const { data: employer, error: employerError } = await supabase
    .from('employer_onboarding')
    .select('id, max_advance_amount')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (employerError) {
    console.error('[credit-overview] ❌ Employer query error:', {
      message: employerError.message,
      details: employerError.details,
      hint: employerError.hint,
      code: employerError.code,
    });
    return NextResponse.json({ error: employerError.message }, { status: 500 });
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

  console.log('[credit-overview] ✓ Employer found:', employer.id, 'Credit limit:', employer.max_advance_amount);

  // Step 2: Fetch employees
  console.log('[credit-overview] Fetching employees for employer:', employer.id);
  const { data: employees, error: employeeError } = await supabase
    .from('employee_onboarding')
    .select('id')
    .eq('employer_id', employer.id);

  if (employeeError) {
    console.error('[credit-overview] ❌ Employee query error:', {
      message: employeeError.message,
      details: employeeError.details,
      hint: employeeError.hint,
      code: employeeError.code,
    });
    return NextResponse.json({ error: employeeError.message }, { status: 500 });
  }

  const employeeIds = (employees ?? []).map((e) => e.id);
  console.log('[credit-overview] ✓ Found employees:', employeeIds.length);

  if (employeeIds.length === 0) {
    console.log('[credit-overview] No employees, returning empty stats');
    const companyCreditLimit = Number(employer.max_advance_amount ?? 0);
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

  // Step 3: Fetch advances data
  console.log('[credit-overview] Fetching advances for', employeeIds.length, 'employees');
  console.log('[credit-overview] Date range:', range.from, 'to', range.to);

  const [outstandingQuery, monthQuery] = await Promise.all([
    supabase
      .from('advances')
      .select('amount')
      .in('employee_id', employeeIds)
      .in('status', ['approved', 'disbursed']),
    supabase
      .from('advances')
      .select('amount')
      .in('employee_id', employeeIds)
      .in('status', ['approved', 'disbursed'])
      .gte('created_at', range.from)
      .lte('created_at', range.to),
  ]);

  if (outstandingQuery.error) {
    console.error('[credit-overview] ❌ Outstanding advances query error:', {
      message: outstandingQuery.error.message,
      details: outstandingQuery.error.details,
      hint: outstandingQuery.error.hint,
      code: outstandingQuery.error.code,
    });
    return NextResponse.json({ error: outstandingQuery.error.message }, { status: 500 });
  }

  console.log('[credit-overview] ✓ Outstanding advances found:', outstandingQuery.data?.length ?? 0);

  if (monthQuery.error) {
    console.error('[credit-overview] ❌ Month advances query error:', {
      message: monthQuery.error.message,
      details: monthQuery.error.details,
      hint: monthQuery.error.hint,
      code: monthQuery.error.code,
    });
    return NextResponse.json({ error: monthQuery.error.message }, { status: 500 });
  }

  console.log('[credit-overview] ✓ Month advances found:', monthQuery.data?.length ?? 0);

  // Step 4: Calculate totals
  const sumAmounts = (rows: AdvanceAmountRow[] | null) => (rows ?? []).reduce((sum, row) => {
    return sum + Number(row.amount ?? 0);
  }, 0);

  const companyCreditLimit = Number(employer.max_advance_amount ?? 0);
  const totalOutstandingCredit = sumAmounts((outstandingQuery.data ?? []) as AdvanceAmountRow[]);
  const monthDisbursedAmount = sumAmounts((monthQuery.data ?? []) as AdvanceAmountRow[]);
  const remainingMonthlyLimit = Math.max(0, companyCreditLimit - monthDisbursedAmount);
  const availableCompanyCredit = Math.max(0, companyCreditLimit - totalOutstandingCredit);
  const utilizationPercent = companyCreditLimit > 0
    ? Math.round((monthDisbursedAmount / companyCreditLimit) * 1000) / 10
    : 0;

  console.log('[credit-overview] ✓ Calculations complete:', {
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