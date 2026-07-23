import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { buildCsv } from '@/lib/server/export-utils';
import { dbErrorResponse } from '@/lib/api-errors';
import { OUTSTANDING_STATUSES } from '@/lib/constants/advance-status';

export const runtime = 'nodejs';

interface EmployeeRow {
  id: string;
  user_id: string | null;
  employee_code: string | null;
  monthly_salary: number | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
}

interface AdvanceRow {
  id: string;
  employee_id: string;
  amount: number | string | null;
  fee_amount: number | string | null;
}

function parseMonthRange(monthParam: string | null): { key: string; fromIso: string; toIso: string } {
  const now = new Date();
  const [year, month] = monthParam?.split('-').map(Number) ?? [now.getFullYear(), now.getMonth() + 1];
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  return {
    key: `${year}-${String(month).padStart(2, '0')}`,
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const monthParam = req.nextUrl.searchParams.get('month');
  const range = parseMonthRange(monthParam);

  const { data: employer, error: employerError } = await supabase
    .from('employers')
    .select('id, onboarding_id, company_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (employerError) {
    return dbErrorResponse('employer-dashboard/payroll/reconciliation-file', employerError);
  }
  if (!employer) {
    const { data: obFallback } = await supabase
      .from('employer_onboarding')
      .select('id, company_name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const companyName = obFallback?.company_name ?? 'Employer';
    const csv = buildCsv([
      ['Report', 'Payroll Deduction Reconciliation'],
      ['Company', companyName],
      ['Month', range.key],
      ['Message', 'No active employer account found. Please complete onboarding.'],
    ]);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payroll-deductions-${range.key}.csv"`,
      },
    });
  }

  const { data: employees, error: employeeError } = await supabase
    .from('employees')
    .select('id, user_id, employee_code, monthly_salary')
    .eq('employer_id', employer.id)
    .eq('status', 'Active');

  if (employeeError) {
    return dbErrorResponse('employer-dashboard/payroll/reconciliation-file', employeeError);
  }

  const employeeRows = (employees ?? []) as EmployeeRow[];
  const employeeIds = employeeRows.map((row) => row.id);
  if (employeeIds.length === 0) {
    const csv = buildCsv([
      ['Report', 'Payroll Deduction Reconciliation'],
      ['Company', employer.company_name ?? 'Employer'],
      ['Month', range.key],
      ['Message', 'No employees found for this employer.'],
    ]);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payroll-deductions-${range.key}.csv"`,
      },
    });
  }

  const userIds = employeeRows.map((row) => row.user_id).filter((id): id is string => Boolean(id));
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] };
  const profilesMap = new Map<string, ProfileRow>(((profiles ?? []) as ProfileRow[]).map((row) => [row.id, row]));

  const { data: advances, error: advanceError } = await supabase
    .from('advances')
    .select('id, employee_id, amount, fee_amount')
    .in('employee_id', employeeIds)
    .in('status', ['approved', ...OUTSTANDING_STATUSES])
    .gte('created_at', range.fromIso)
    .lte('created_at', range.toIso);

  if (advanceError) {
    return dbErrorResponse('employer-dashboard/payroll/reconciliation-file', advanceError);
  }

  const grouped = new Map<string, { principal: number; fees: number; refs: string[] }>();
  for (const adv of (advances ?? []) as AdvanceRow[]) {
    const current = grouped.get(adv.employee_id) ?? { principal: 0, fees: 0, refs: [] };
    current.principal += Number(adv.amount ?? 0);
    current.fees += Number(adv.fee_amount ?? 0);
    current.refs.push(`EWA-${adv.id.slice(0, 8).toUpperCase()}`);
    grouped.set(adv.employee_id, current);
  }

  const rows: Array<Array<string | number>> = [
    ['Report', 'Payroll Deduction Reconciliation'],
    ['Company', employer.company_name ?? 'Employer'],
    ['Month', range.key],
    ['Generated At', new Date().toISOString()],
    [''],
    ['Employee Code', 'Employee Name', 'Gross Salary', 'Advance Principal', 'Platform Fees', 'Total Deduction', 'Net Salary After Deduction', 'Advance References'],
  ];

  let totalGross = 0;
  let totalPrincipal = 0;
  let totalFees = 0;
  let totalDeductions = 0;

  for (const employee of employeeRows) {
    const sum = grouped.get(employee.id);
    if (!sum) continue;

    const gross = Number(employee.monthly_salary ?? 0);
    const total = sum.principal + sum.fees;
    const net = Math.max(0, gross - total);
    const fullName = employee.user_id ? profilesMap.get(employee.user_id)?.full_name : null;

    totalGross += gross;
    totalPrincipal += sum.principal;
    totalFees += sum.fees;
    totalDeductions += total;

    rows.push([
      employee.employee_code ?? '',
      fullName ?? employee.employee_code ?? 'Employee',
      gross.toFixed(2),
      sum.principal.toFixed(2),
      sum.fees.toFixed(2),
      total.toFixed(2),
      net.toFixed(2),
      sum.refs.join('; '),
    ]);
  }

  rows.push(['']);
  rows.push(['Totals', '', totalGross.toFixed(2), totalPrincipal.toFixed(2), totalFees.toFixed(2), totalDeductions.toFixed(2), Math.max(0, totalGross - totalDeductions).toFixed(2), '']);

  const csv = buildCsv(rows);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="payroll-deductions-${range.key}.csv"`,
    },
  });
}
