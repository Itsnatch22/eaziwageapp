// SCHEMA NOTE: employer_onboarding uses max_advance_percentage + cooldown_period
// employers uses advance_limit_percent + cooldown_days
// Do not swap these — they are different columns on different tables
import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrencyFromCountry, calculateFeePercentage } from '@/lib/utils';
import { dbErrorResponse } from '@/lib/api-errors';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch employee_onboarding
    const { data: employee, error: employeeError } = await supabase
      .from('employee_onboarding')
      .select('id, user_id, employer_id, monthly_salary, country')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (employeeError) {
      return dbErrorResponse('employee-dashboard/calculator', employeeError);
    }

    if (!employee) {
      return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
    }

    // 3. Fetch employees.id for this user
    const { data: employeeRecord } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const employeeId = employeeRecord?.id ?? null;

    // Defaults
    let advance_limit_percent = 50;
    let min_advance_amount = 500;
    let max_advance_amount = 50000;
    let cooldown_days = 7;
    let max_monthly_advances = 3;
    let ewa_enabled = true;

    // 4. Fetch employee_ewa_settings
    const { data: ewsRow } = employeeId
      ? await supabase
          .from('employee_ewa_settings')
          .select('ewa_enabled, max_advance_percentage, min_advance_amount, max_advance_amount, cooldown_period, max_monthly_advances')
          .eq('employee_id', employeeId)
          .maybeSingle()
      : { data: null };

    if (ewsRow) {
      ewa_enabled = ewsRow.ewa_enabled ?? ewa_enabled;
      advance_limit_percent = ewsRow.max_advance_percentage ?? advance_limit_percent;
      min_advance_amount = Number(ewsRow.min_advance_amount ?? min_advance_amount);
      max_advance_amount = Number(ewsRow.max_advance_amount ?? max_advance_amount);
      cooldown_days = Number(ewsRow.cooldown_period ?? cooldown_days);
      max_monthly_advances = Number(ewsRow.max_monthly_advances ?? max_monthly_advances);
    } else {
      // Try employers table
      const { data: employersRow } = await supabase
        .from('employers')
        .select('advance_limit_percent, min_advance_amount, cooldown_days, max_monthly_advances')
        .eq('onboarding_id', employee.employer_id)
        .maybeSingle();

      if (employersRow) {
        advance_limit_percent = employersRow.advance_limit_percent ?? advance_limit_percent;
        min_advance_amount = Number(employersRow.min_advance_amount ?? min_advance_amount);
        cooldown_days = Number(employersRow.cooldown_days ?? cooldown_days);
        max_monthly_advances = Number(employersRow.max_monthly_advances ?? max_monthly_advances);
      }
      // No employers row — use hardcoded defaults initialised above.
      // Never fall back to employer_onboarding for max_advance_percentage/cooldown_period:
      // those are onboarding-time snapshots; live eligibility config lives in employers only.
    }

    // 5. Fetch display/fee metadata from employer_onboarding.
    //    risk_score and payroll_cycle are NOT eligibility columns — reading them from
    //    employer_onboarding is intentional (they are KYC-time metadata, not live config).
    const { data: employerOnboarding } = await supabase
      .from('employer_onboarding')
      .select('risk_score, payroll_cycle, country')
      .eq('id', employee.employer_id)
      .maybeSingle();

    const risk_score = employerOnboarding?.risk_score ?? 3;
    const payroll_cycle = employerOnboarding?.payroll_cycle ?? 'monthly';

    // 6. Count advances this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    let advances_this_month = 0;
    if (employeeId) {
      const { count } = await supabase
        .from('advances')
        .select('id', { count: 'exact', head: true })
        .eq('employee_id', employeeId)
        .in('status', ['pending', 'completed', 'processing', 'disbursed', 'approved'])
        .gte('created_at', startOfMonth);
      advances_this_month = count ?? 0;
    }

    // 7. Fetch last completed advance for cooldown check
    let lastAdvanceAt: string | null = null;
    if (employeeId) {
      const { data: lastAdvance } = await supabase
        .from('advances')
        .select('requested_at, disbursed_at')
        .eq('employee_id', employeeId)
        .in('status', ['approved', 'paid', 'completed', 'disbursed'])
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastAdvance) {
        lastAdvanceAt = lastAdvance.disbursed_at ?? lastAdvance.requested_at ?? null;
      }
    }

    // 8. Currency
    const currency = getCurrencyFromCountry(
      employerOnboarding?.country ?? employee.country,
      'KES',
    );

    // 9. Processing fee
    const processing_fee_pct = calculateFeePercentage(risk_score);

    // 10. Current limit
    const monthly_salary = Number(employee.monthly_salary || 0);
    let current_limit = (monthly_salary * advance_limit_percent) / 100;
    if (max_advance_amount && current_limit > max_advance_amount) {
      current_limit = max_advance_amount;
    }

    // 11. Cooldown days remaining
    let cooldown_days_remaining = 0;
    if (lastAdvanceAt && cooldown_days > 0) {
      const lastDate = new Date(lastAdvanceAt).getTime();
      const daysSince = Math.floor((now.getTime() - lastDate) / (1000 * 60 * 60 * 24));
      cooldown_days_remaining = Math.max(0, cooldown_days - daysSince);
    }

    return NextResponse.json({
      monthly_salary,
      advance_limit_percent,
      min_advance_amount,
      max_advance_amount,
      processing_fee_pct,
      cooldown_days,
      max_monthly_advances,
      currency,
      payroll_cycle,
      advances_this_month,
      cooldown_days_remaining,
      current_limit,
      ewa_enabled,
    });
  } catch (err) {
    console.error('[EmployeeCalculator] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
