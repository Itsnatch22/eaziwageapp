import { supabaseAdmin } from '../supabaseAdmin';
import { dusupayClient } from '../dusupay/client';
import { PayoutMethod, Currency } from '../dusupay/types';
import { generateMerchantReference } from '../dusupay/utils';
import { runFraudChecks } from '../fraud-engine';
import { generateRepaymentReference } from '../repayment/utils';
import { notifyAdmin } from '../notifications';

// ─── Repayment schedule helpers ──────────────────────────────────────────────

type ScheduleAdvanceInput = {
  id: string;
  employer_id: string;
  employee_id: string;
  amount: number | string | null;
  currency?: string | null;
  organization_id?: string | null;
};

function calculateDueDate(disbursedAt: Date, payrollCycle: string | null): Date {
  const due = new Date(disbursedAt);
  switch (payrollCycle?.toLowerCase()) {
    case 'weekly':
      due.setDate(due.getDate() + 7);
      break;
    case 'bi-weekly':
    case 'biweekly':
      due.setDate(due.getDate() + 14);
      break;
    case 'monthly':
    default:
      due.setMonth(due.getMonth() + 1);
      due.setDate(1); // first of next month
      break;
  }
  return due;
}

async function createRepaymentSchedule(
  advance: ScheduleAdvanceInput,
  disbursedAt: Date,
  supabase: typeof supabaseAdmin,
): Promise<void> {
  const { data: employer } = await supabase
    .from('employers')
    .select('payroll_cycle, id')
    .eq('id', advance.employer_id)
    .single();

  if (!employer) throw new Error(`Employer ${advance.employer_id} not found for repayment schedule`);

  const dueDate = calculateDueDate(disbursedAt, employer.payroll_cycle);

  const reference = generateRepaymentReference(advance.employer_id, advance.id, dueDate);

  const insertPayload: Record<string, unknown> = {
    advance_id:           advance.id,
    employer_id:          advance.employer_id,
    employee_id:          advance.employee_id,
    repayment_amount:     advance.amount,
    currency:             advance.currency ?? 'KES',
    due_date:             dueDate.toISOString().split('T')[0],
    payroll_cycle:        employer.payroll_cycle ?? 'monthly',
    repayment_reference:  reference,
    status:               'pending',
    paid_amount:          0,
  };
  if (advance.organization_id) {
    insertPayload.organization_id = advance.organization_id;
  }

  const { error } = await supabase.from('repayment_schedules').insert(insertPayload);
  if (error) throw new Error(`Failed to create repayment schedule: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────

export class PayoutService {
  async fundEmployerWallet(
    employerId: string,
    amount: number,
    adminId: string,
    description: string = 'Funding from Stanbic'
  ) {
    const { data: adminWallet, error: adminWalletError } = await supabaseAdmin
      .from('admin_wallets')
      .select('id, balance')
      .eq('name', 'Main Stanbic Source')
      .single();

    if (adminWalletError || !adminWallet) {
      throw new Error(`Admin wallet not found: ${adminWalletError?.message}`);
    }

    if (adminWallet.balance < amount) {
      throw new Error('Insufficient funds in platform Stanbic source');
    }

    const { data, error } = await supabaseAdmin.rpc('fund_employer_from_admin', {
      p_employer_id: employerId,
      p_admin_wallet_id: adminWallet.id,
      p_amount: amount,
      p_description: description,
      p_admin_id: adminId
    });

    if (error) {
      throw new Error(`Funding failed: ${error.message}`);
    }

    return data;
  }

  async reserveFunds(employerId: string, amount: number, advanceId: string) {
  const { data, error } = await supabaseAdmin.rpc('reserve_employer_funds', {
    p_employer_id: employerId,
    p_amount: amount,
    p_advance_id: advanceId,
  });

  if (error) throw new Error(`Failed to reserve funds: ${error.message}`);
  return data; // returns wallet_transaction id
}

  /**
   * Disburse an approved advance to an employee via DusuPay.
   */
  async disburseAdvance(advanceId: string) {
    type FraudFlagInput = { flagType: string; severity: string; description: string; metadata?: Record<string, unknown> };
    type EligibilityCheckResult = { eligible: boolean; rejectionReason?: string; fraudFlags: FraudFlagInput[] };
    const firstRow = <T,>(value: T | T[] | null | undefined): T | undefined =>
      Array.isArray(value) ? value[0] : value ?? undefined;
    const toNumber = (value: number | string | null | undefined, fallback = 0) => {
      const parsed = Number(value ?? fallback);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const { data: advanceRow, error: advanceError } = await supabaseAdmin
      .from('advances')
      .select(`
        *,
        e:employees(id, full_name, kyc_status, status:status, risk_score, employer_id, country, monthly_salary),
        er:employers(ewa_enabled, disbursements_frozen, freeze_reason, is_defaulted, processing_fee, advance_limit_percent, min_advance_amount, cooldown_days, max_monthly_advances, weekend_access),
        ees:employee_ewa_settings(ewa_enabled, max_advance_percentage, max_advance_amount, min_advance_amount, cooldown_period)
      `)
      .eq('id', advanceId)
      .maybeSingle();

    if (advanceError || !advanceRow) {
      throw new Error(`Advance not found: ${advanceError?.message || 'missing'}`);
    }

    interface AdvanceRow {
      id: string;
      employee_id: string;
      employer_id: string;
      amount: number | string | null;
      fee_amount?: number | string | null;
      fee_percentage?: number | string | null;
      net_amount?: number | string | null;
      currency?: string | null;
      status?: string | null;
      payment_method_id?: string | null;
    }

    interface EmployeeRow {
      id: string;
      full_name?: string | null;
      kyc_status?: string | null;
      status?: string | null;
      risk_score?: number | null;
      employer_id?: string | null;
      country?: string | null;
      monthly_salary?: number | string | null;
    }

    interface EmployerRow {
      ewa_enabled?: boolean | null;
      disbursements_frozen?: boolean | null;
      freeze_reason?: string | null;
      is_defaulted?: boolean | null;
      processing_fee?: number | string | null;
      advance_limit_percent?: number | string | null;
      min_advance_amount?: number | string | null;
      cooldown_days?: number | string | null;
      max_monthly_advances?: number | string | null;
      weekend_access?: boolean | null;
    }

    interface EESRow {
      ewa_enabled?: boolean | null;
      max_advance_percentage?: number | string | null;
      max_advance_amount?: number | string | null;
      min_advance_amount?: number | string | null;
      cooldown_period?: number | string | null;
    }

    const advance = advanceRow as unknown as AdvanceRow;
    const employee = firstRow(advanceRow.e as unknown as EmployeeRow | EmployeeRow[]);
    const employer = firstRow(advanceRow.er as unknown as EmployerRow | EmployerRow[]);
    const ees = firstRow(advanceRow.ees as unknown as EESRow | EESRow[]);

    const advanceAmount = toNumber(advance.amount);
    const netAmount = toNumber(advance.net_amount, advanceAmount);

    if (!['pending', 'approved'].includes((advance.status as string) ?? '')) {
      throw new Error(`Advance not in disbursable status: ${advance.status}`);
    }

    // Atomically claim this advance before any async work to prevent concurrent disbursements
    const { data: locked } = await supabaseAdmin
      .from('advances')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', advanceId)
      .in('status', ['pending', 'approved'])
      .select('id')
      .maybeSingle();

    if (!locked) {
      throw new Error(`Advance ${advanceId} already claimed by another process`);
    }

    if (employer?.disbursements_frozen) {
      await supabaseAdmin.from('advances').update({ status: 'rejected', reason: `Employer disbursements frozen: ${employer.freeze_reason}` }).eq('id', advanceId);
      throw new Error(`Employer disbursements frozen: ${employer.freeze_reason}`);
    }

    if (!employer?.ewa_enabled) {
      await supabaseAdmin.from('advances').update({ status: 'rejected', reason: 'EWA not enabled for this employer' }).eq('id', advanceId);
      throw new Error('EWA not enabled for employer');
    }

    const checkEmployeeEligibility = async (): Promise<EligibilityCheckResult> => {
      const flags: FraudFlagInput[] = [];

      if (employee?.status !== 'active') {
        return { eligible: false, rejectionReason: 'Employee is not active', fraudFlags: [] };
      }
      if (employee?.kyc_status !== 'approved') {
        return { eligible: false, rejectionReason: 'Employee KYC not approved', fraudFlags: [] };
      }
      if (!ees?.ewa_enabled) {
        return { eligible: false, rejectionReason: 'EWA disabled for this employee', fraudFlags: [] };
      }

      // DB risk_score is on a 0–5 scale (constraint: 0 <= score <= 5).
      // Thresholds below are the 0–5 equivalents of the original 0–10 intent (÷2).
      const riskThreshold = 3.75;
      if (typeof employee.risk_score === 'number' && employee.risk_score > riskThreshold) {
        flags.push({
          flagType: 'risk_score_threshold',
          severity: employee.risk_score >= 4.5 ? 'critical' : 'high',
          description: `Employee risk score ${employee.risk_score} exceeds threshold ${riskThreshold}`,
        });
      }

      const effectiveMaxPercent = toNumber(ees?.max_advance_percentage ?? employer?.advance_limit_percent, 50);
      // Integer-cent arithmetic — avoids float imprecision on salary × percent
      const salaryMinor = Math.round(toNumber(employee?.monthly_salary) * 100);
      const maxAllowedMinor = Math.floor(salaryMinor * effectiveMaxPercent / 100);
      const advanceMinor = Math.round(advanceAmount * 100);
      if (advanceMinor > maxAllowedMinor) {
        const maxAllowed = maxAllowedMinor / 100;
        return { eligible: false, rejectionReason: `Requested amount exceeds limit of ${maxAllowed}`, fraudFlags: [] };
      }

      const effectiveMin = toNumber(ees?.min_advance_amount ?? employer?.min_advance_amount, 500);
      const effectiveMinMinor = Math.round(effectiveMin * 100);
      if (advanceMinor < effectiveMinMinor) {
        return { eligible: false, rejectionReason: `Amount below minimum of ${effectiveMin}`, fraudFlags: [] };
      }

      const isWeekend = [0, 6].includes(new Date().getDay());
      if (isWeekend && !employer?.weekend_access) {
        return { eligible: false, rejectionReason: 'Advances not permitted on weekends for this employer', fraudFlags: [] };
      }

      const cooldownDays = toNumber(ees?.cooldown_period ?? employer?.cooldown_days, 7);
      const { data: recentAdvance } = await supabaseAdmin
        .from('advances')
        .select('disbursed_at')
        .eq('employee_id', advance.employee_id)
        .eq('status', 'completed')
        .order('disbursed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentAdvance?.disbursed_at) {
        const daysSince = Math.floor((Date.now() - new Date(recentAdvance.disbursed_at).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince < cooldownDays) {
          return { eligible: false, rejectionReason: `Cooldown active: ${cooldownDays - daysSince} days remaining`, fraudFlags: [] };
        }
      }

      const maxMonthly = toNumber(employer?.max_monthly_advances, 2);
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
      const monthSelect = await supabaseAdmin
        .from('advances')
        .select('id', { count: 'exact', head: true })
        .eq('employee_id', advance.employee_id)
        .in('status', ['completed', 'processing'])
        .gte('created_at', monthStart.toISOString());

      const monthCount = (monthSelect.count as number) ?? 0;
      if (monthCount >= maxMonthly) {
        flags.push({ flagType: 'velocity', severity: 'high', description: `Employee has reached monthly advance limit of ${maxMonthly}`, metadata: { month_count: monthCount, limit: maxMonthly } });
      }

      return { eligible: flags.length === 0 || flags.every(f => f.severity === 'low'), fraudFlags: flags };
    };

    const eligibility = await checkEmployeeEligibility();
    if (!eligibility.eligible && eligibility.rejectionReason) {
      await supabaseAdmin.from('advances').update({ status: 'rejected', reason: eligibility.rejectionReason }).eq('id', advanceId);
      throw new Error(eligibility.rejectionReason);
    }

    const fraudFlags: FraudFlagInput[] = [...eligibility.fraudFlags];

    try {
      const engineResult = await runFraudChecks({
        userId: advance.employee_id,
        employeeId: advance.employee_id,
        employerId: advance.employer_id,
        amount: advanceAmount,
      });
      if (engineResult.isBlocked) {
        fraudFlags.push({ flagType: 'engine_block', severity: 'critical', description: 'Blocked by fraud rules engine' });
      }
    } catch {
      await supabaseAdmin.from('advances')
        .update({ status: 'fraud_review', reason: 'Fraud engine unavailable' })
        .eq('id', advanceId);
      throw new Error('Fraud engine unavailable — advance held for manual review');
    }

    const { data: paymentMethod } = await supabaseAdmin
      .from('payment_methods')
      .select('id, method_type, provider_name, account_number, phone_number, account_name, country_code, is_verified, is_active')
      .eq('id', advance.payment_method_id)
      .maybeSingle();

    if (!paymentMethod || !paymentMethod.is_verified || !paymentMethod.is_active) {
      fraudFlags.push({ flagType: 'unverified_payment_method', severity: 'high', description: 'Payment method not verified or inactive' });
    }

    if (fraudFlags.length > 0) {
      const severityOrder: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
      fraudFlags.sort((a, b) => (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0));
      const highest = fraudFlags[0];

      const { data: flagRecord } = await supabaseAdmin
        .from('fraud_flags')
        .insert({
          advance_id: advanceId,
          employee_id: advance.employee_id,
          employer_id: advance.employer_id,
          flag_type: highest.flagType,
          severity: highest.severity,
          description: fraudFlags.map(f => f.description).join('; '),
          triggered_by: 'system',
          status: 'open',
          metadata: { all_flags: fraudFlags }
        })
        .select()
        .single();

      await supabaseAdmin
        .from('advances')
        .update({ status: 'fraud_review', fraud_flag_id: flagRecord.id, auto_approved: false })
        .eq('id', advanceId);

      void supabaseAdmin.from('system_audit_logs').insert({
        admin_id: advance.employer_id,
        admin_name: 'system:fraud-engine',
        target_id: advanceId,
        target_type: 'advance',
        action: 'advance_fraud_review',
        old_value: { status: 'pending' },
        new_value: { status: 'fraud_review', fraud_flag_id: flagRecord.id },
        metadata: { flags: fraudFlags, employee_id: advance.employee_id },
      });

      return { success: false, status: 'fraud_review', heldForFraudReview: true, fraudFlagId: flagRecord.id };
    }

   await supabaseAdmin.from('advances').update({ status: 'processing', auto_approved: true, approved_at: new Date().toISOString() }).eq('id', advanceId);

    const merchantReference = generateMerchantReference(advanceId);

    const pm = paymentMethod!; 

    const payoutMethod = (pm.method_type === 'mobile_money') ? PayoutMethod.MOBILE_MONEY : PayoutMethod.BANK;
    const account = pm.method_type === 'bank' ? pm.account_number : pm.phone_number;

    if (!account) {
      await supabaseAdmin.from('advances').update({ status: 'failed', reason: 'Missing account for payout' }).eq('id', advanceId);
      throw new Error('Missing account for payout');
    }

    let payoutResponse;
    try {
      payoutResponse = await dusupayClient.sendFunds({
        merchant_reference: merchantReference,
        transaction_method: payoutMethod,
        currency: advance.currency as Currency,
        amount: netAmount,
        provider_code: pm.provider_name,
        account_number: account,
        customer_name: employee?.full_name ?? 'EaziWage Employee',
        description: `EaziWage Advance: ${advanceId}`,
      });
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : 'DusuPay sendFunds failed';
      await supabaseAdmin.from('advances').update({ status: 'failed', reason }).eq('id', advanceId);
      throw new Error(reason);
    }

    await supabaseAdmin.from('dusupay_transactions').upsert({
      merchant_reference: merchantReference,
      internal_reference: payoutResponse.data?.internal_reference,
      event_type: 'payout_initiated',
      status: payoutResponse.data?.transaction_status ?? 'PENDING',
      amount: netAmount,
      currency: advance.currency,
      raw_payload: payoutResponse
    }, { onConflict: 'merchant_reference,event_type' });

    try {
      await supabaseAdmin.rpc('increment_employer_liability', {
        p_employer_id: advance.employer_id,
        p_amount: advanceAmount,
        p_currency: advance.currency,
      });
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : 'Failed to update employer liability';
      await supabaseAdmin.from('advances').update({ status: 'failed', reason }).eq('id', advanceId);
      throw new Error(reason);
    }

    const disbursedAt = new Date();
    await supabaseAdmin.from('advances').update({
      status: 'completed',
      reference: merchantReference,
      internal_reference: payoutResponse.data?.internal_reference ?? null,
      disbursed_at: disbursedAt.toISOString(),
    }).eq('id', advanceId);

    // Create repayment schedule — non-blocking. Advance is already disbursed; a
    // schedule creation failure must never roll back or fail the disbursement.
    try {
      await createRepaymentSchedule(advance as ScheduleAdvanceInput, disbursedAt, supabaseAdmin);
    } catch (scheduleErr) {
      console.error('[disburseAdvance] Repayment schedule creation failed:', scheduleErr);
      void notifyAdmin({
        type: 'system_alert',
        title: 'Repayment Schedule Creation Failed',
        message: `Failed to create repayment schedule for advance ${advanceId}. Manual schedule creation required.`,
        metadata: { advance_id: advanceId, employer_id: advance.employer_id, error: String(scheduleErr) },
      });
    }

    // Audit trail — required for CBK 5-year transaction retention
    void supabaseAdmin.from('system_audit_logs').insert({
      admin_id: advance.employer_id,
      admin_name: 'system:payout-service',
      target_id: advanceId,
      target_type: 'advance',
      action: 'advance_disbursed',
      old_value: { status: 'pending' },
      new_value: { status: 'completed', merchant_reference: merchantReference, amount: advanceAmount, net_amount: netAmount },
      metadata: { employee_id: advance.employee_id, employer_id: advance.employer_id, currency: advance.currency },
    });

    return {
      success: true,
      status: 'completed',
      merchantReference,
      internalReference: payoutResponse.data?.internal_reference ?? null,
    };
  }

  /**
   * Handle repayment of an advance (e.g. from salary deduction).
   * This adds funds back to the Admin Wallet and settles the employer's arrears if any.
   */
  async handleRepayment(advanceId: string, amount: number) {
    const { data, error } = await supabaseAdmin.rpc('repay_advance_to_admin', {
      p_advance_id: advanceId,
      p_amount: amount,
    });

    if (error) {
      throw new Error(`Repayment failed: ${error.message}`);
    }

    const { error: scheduleError } = await supabaseAdmin
      .from('repayment_schedules')
      .update({
        status:     'paid',
        paid_amount: amount,
        paid_at:    new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('advance_id', advanceId)
      .eq('status', 'pending'); // never overwrite an already-paid record

    if (scheduleError) {
      console.error('[handleRepayment] Failed to update repayment schedule:', scheduleError);
      // Non-blocking — repayment RPC already succeeded
    }

    return data;
  }
}

export const payoutService = new PayoutService();
