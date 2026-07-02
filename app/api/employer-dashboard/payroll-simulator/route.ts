import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrencyFromCountry } from '@/lib/utils';
import { dbErrorResponse } from '@/lib/api-errors';
import { DISBURSED_STATUSES } from '@/lib/constants/advance-status';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve employer
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, country, payroll_cycle, onboarding_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (employerError) {
      return dbErrorResponse('employer-dashboard/payroll-simulator', employerError);
    }

    let employerId: string;
    let country: string | null = null;
    let payroll_cycle: string | null = null;

    if (employer) {
      employerId = employer.id;
      country = employer.country ?? null;
      payroll_cycle = employer.payroll_cycle ?? null;
    } else {
      // Fall back to employer_onboarding
      const { data: onboarding, error: onboardingError } = await supabase
        .from('employer_onboarding')
        .select('id, country, payroll_cycle')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (onboardingError) {
        return dbErrorResponse('employer-dashboard/payroll-simulator', onboardingError);
      }

      if (!onboarding) {
        return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
      }

      employerId = onboarding.id;
      country = onboarding.country ?? null;
      payroll_cycle = onboarding.payroll_cycle ?? null;
    }

    const currency = getCurrencyFromCountry(country ?? '');

    // Get all active employees with salary
    const { data: employeeRows, error: employeesError } = await supabase
      .from('employees')
      .select('id, full_name, employee_code, department, monthly_salary, status')
      .eq('employer_id', employerId)
      .in('status', ['Active', 'approved', 'active']);

    if (employeesError) {
      return dbErrorResponse('employer-dashboard/payroll-simulator', employeesError);
    }

    const employees = employeeRows ?? [];
    const employeeIds = employees.map((e) => e.id);

    // Get unredeemed disbursed advances
    let advances: Array<{
      id: string;
      employee_id: string;
      amount: number | null;
      fee_amount: number | null;
      net_amount: number | null;
      disbursed_at: string | null;
      created_at: string | null;
      currency: string | null;
    }> = [];

    // This month's real disbursed principal + fees, regardless of repayment
    // status — feeds the "Monthly EWA Deduction" card, which previously
    // estimated this as a flat 3.3% of total payroll instead of real data.
    let monthlyDisbursed = 0;
    let monthlyFees = 0;
    let monthlyAdvanceCount = 0;

    if (employeeIds.length > 0) {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

      const [{ data: advanceRows, error: advancesError }, { data: monthRows, error: monthError }] = await Promise.all([
        supabase
          .from('advances')
          .select('id, employee_id, amount, fee_amount, net_amount, disbursed_at, created_at, currency')
          .in('employee_id', employeeIds)
          .in('status', ['completed', 'disbursed'])
          .is('repaid_at', null)
          .order('disbursed_at', { ascending: false }),
        supabase
          .from('advances')
          .select('amount, fee_amount')
          .in('employee_id', employeeIds)
          .in('status', DISBURSED_STATUSES)
          .gte('created_at', monthStart.toISOString()),
      ]);

      if (advancesError) {
        return dbErrorResponse('employer-dashboard/payroll-simulator', advancesError);
      }
      if (monthError) {
        return dbErrorResponse('employer-dashboard/payroll-simulator', monthError);
      }

      advances = advanceRows ?? [];
      monthlyDisbursed = (monthRows ?? []).reduce((sum, a) => sum + Number(a.amount ?? 0), 0);
      monthlyFees = (monthRows ?? []).reduce((sum, a) => sum + Number(a.fee_amount ?? 0), 0);
      monthlyAdvanceCount = (monthRows ?? []).length;
    }

    // Group advances by employee_id
    const advancesByEmployee = new Map<string, typeof advances>();
    for (const advance of advances) {
      const list = advancesByEmployee.get(advance.employee_id) ?? [];
      list.push(advance);
      advancesByEmployee.set(advance.employee_id, list);
    }

    // Build per-employee data
    const employeesPayload = employees.map((emp) => {
      const empAdvances = advancesByEmployee.get(emp.id) ?? [];
      return {
        id: emp.id,
        full_name: emp.full_name ?? null,
        employee_code: emp.employee_code ?? null,
        department: emp.department ?? null,
        monthly_salary: Number(emp.monthly_salary ?? 0),
        advances: empAdvances.map((a) => ({
          id: a.id,
          amount: Number(a.amount ?? 0),
          fee_amount: a.fee_amount != null ? Number(a.fee_amount) : null,
          net_amount: a.net_amount != null ? Number(a.net_amount) : null,
          disbursed_at: a.disbursed_at ?? null,
        })),
      };
    });

    // Compute totals
    const total_payroll = employeesPayload.reduce((sum, e) => sum + e.monthly_salary, 0);
    const total_committed = advances.reduce((sum, a) => sum + Number(a.amount ?? 0), 0);
    const net_payroll_outflow = total_payroll - total_committed;
    const employees_total = employeesPayload.length;
    const employees_affected = employeesPayload.filter((e) => e.advances.length > 0).length;

    return NextResponse.json({
      currency,
      payroll_cycle,
      employees: employeesPayload,
      totals: {
        total_payroll,
        total_committed,
        net_payroll_outflow,
        employees_total,
        employees_affected,
        monthly_disbursed: monthlyDisbursed,
        monthly_fees: monthlyFees,
        monthly_advance_count: monthlyAdvanceCount,
      },
    });
  } catch (err) {
    return dbErrorResponse('employer-dashboard/payroll-simulator', err);
  }
}
