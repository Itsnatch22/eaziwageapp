import { createClient } from '@/lib/supabase/client';

export class EarningsService {
  private supabase = createClient();

  /**
   * Recompute earnings for an employee based on current date
   * This should be called daily via cron job
   */
  async recomputeEmployeeEarnings(employeeId: string): Promise<void> {

    const { data: payrollEntry } = await this.supabase
      .from('payroll_entries')
      .select('*, employees(organization_id)')
      .eq('employee_id', employeeId)
      .order('pay_period_start', { ascending: false })
      .limit(1)
      .single();

    if (!payrollEntry) return;

    const { data: computedData } = await this.supabase.rpc(
      'compute_earnings_for_employee',
      {
        p_employee_id: employeeId,
        p_as_of_date: new Date().toISOString().split('T')[0]
      }
    ).single();
    
    if (!computedData) return;
    const computed = computedData as {
      earned_to_date: number;
      withdrawable_amount: number;
      days_elapsed: number;
      earnings_percentage: number;
    };

    await this.supabase
      .from('earnings_snapshots')
      .insert({
        employee_id: employeeId,
        organization_id: payrollEntry.employees.organization_id,
        current_salary: payrollEntry.salary,
        currency: payrollEntry.currency,
        pay_period_start: payrollEntry.pay_period_start,
        pay_period_end: payrollEntry.pay_period_end,
        payday_date: payrollEntry.payday_date,
        working_days: payrollEntry.working_days,
        daily_rate: payrollEntry.daily_rate,
        earned_to_date: computed.earned_to_date,
        withdrawable_amount: computed.withdrawable_amount,
        days_elapsed: computed.days_elapsed,
        earnings_percentage: computed.earnings_percentage
      });

    this.supabase.channel('earnings-updates')
      .send({
        type: 'broadcast',
        event: 'earnings_updated',
        payload: { employeeId, ...computed }
      });
  }

  /**
   * Get current withdrawable amount for employee
   */
  async getWithdrawableAmount(employeeId: string): Promise<number> {
    const { data: snapshot } = await this.supabase
      .from('earnings_snapshots')
      .select('remaining_withdrawable')
      .eq('employee_id', employeeId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .single();

    return snapshot?.remaining_withdrawable || 0;
  }

  /**
   * Validate withdrawal request
   */
  async validateWithdrawal(employeeId: string, amount: number): Promise<{
    valid: boolean;
    reason?: string;
    available: number;
  }> {
    const available = await this.getWithdrawableAmount(employeeId);
    
    if (amount <= 0) {
      return { valid: false, reason: 'Amount must be positive', available };
    }
    
    if (amount > available) {
      return { valid: false, reason: 'Insufficient earned wages', available };
    }






    return { valid: true, available };
  }
}