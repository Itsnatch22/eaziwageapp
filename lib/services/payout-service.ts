import { supabaseAdmin } from '../supabaseAdmin';
import { dusupayClient } from '../dusupay/client';
import { PayoutMethod, Currency, PayoutStatus } from '../dusupay/types';
import { generateMerchantReference, formatPhoneNumber, resolveProviderCode, COUNTRY_PROVIDER_PREFIXES } from '../dusupay/utils';
import { runFraudChecks } from '../fraud-engine';
import { generateRepaymentReference, resolveEffectivePaydayDayOfMonth } from '../repayment/utils';
import { notifyAdmin } from '../notifications';
import { getEnv } from '@/env';
import { convertFromUSD, convertToUSD, getCurrencyFromCountry, normalizeCountryCode } from '../utils';
import { normalizeAdvanceTerminalStatus } from '../constants/advance-status';
import { validateTreasuryBalance, TreasuryValidationError } from './treasury-service';

// Platform-wide defaults an admin configures via the Global Settings tab
// (app/admin/settings — Global Settings). Stored in USD; converted to the
// employer's local currency at the point of comparison. Used only when an
// employer/employee hasn't set a more specific override — see the fallback
// chains in disburseAdvance below.
type PlatformSettings = {
  default_advance_percent?: number;
  min_advance_amount?: number;
  max_advance_amount?: number;
  daily_advance_limit?: number;
  default_cooldown_days?: number;
  monthly_advance_limit?: number;
  new_employee_wait_days?: number;
  instant_mobile_enabled?: boolean;
  bank_transfers_enabled?: boolean;
  weekend_advances_enabled?: boolean;
};

type NotificationSettings = {
  large_advance_threshold?: number;
  daily_volume_threshold?: number;
};

// risk_score (employees.risk_score) is 0–5 where HIGHER = SAFER — confirmed
// against app/api/admin/settings/employees/route.ts's risk_level derivation
// and RiskScoringClient.tsx's employer rating, both of which treat a high
// score as low risk.
type RiskSettings = {
  employee_medium_threshold?: number;
  auto_suspend_threshold?: number;
  reduce_limits_threshold?: number;
};

async function loadGlobalSettings(): Promise<{ platform: PlatformSettings; notifications: NotificationSettings; risk: RiskSettings; rates: Record<string, number> }> {
  const [{ data: globalRow }, { data: exchangeRates }] = await Promise.all([
    supabaseAdmin.from('global_settings').select('platform_settings, notification_settings, risk_settings').eq('id', 'default').maybeSingle(),
    supabaseAdmin.from('exchange_rates').select('currency_code, rate_to_usd'),
  ]);

  const rates = (exchangeRates || []).reduce((acc: Record<string, number>, rate) => {
    if (rate.currency_code) acc[rate.currency_code.toUpperCase()] = Number(rate.rate_to_usd ?? 0);
    return acc;
  }, {} as Record<string, number>);

  return {
    platform: (globalRow?.platform_settings as PlatformSettings) ?? {},
    notifications: (globalRow?.notification_settings as NotificationSettings) ?? {},
    risk: (globalRow?.risk_settings as RiskSettings) ?? {},
    rates,
  };
}

// Notifications tab thresholds (both stored in USD) — fires admin alerts that
// were previously configurable but never actually triggered by anything.
async function checkVolumeAlerts(
  advanceId: string,
  advanceAmount: number,
  currency: string,
  notificationSettings: NotificationSettings,
  rates: Record<string, number>,
): Promise<void> {
  const advanceAmountUSD = convertToUSD(advanceAmount, currency, rates);

  if (notificationSettings.large_advance_threshold != null && advanceAmountUSD >= notificationSettings.large_advance_threshold) {
    void notifyAdmin({
      type: 'review_request',
      title: 'Large Advance Disbursed',
      message: `Advance ${advanceId} for ${advanceAmountUSD.toFixed(2)} USD exceeded the configured large-advance threshold of ${notificationSettings.large_advance_threshold} USD.`,
      metadata: { advance_id: advanceId, amount_usd: advanceAmountUSD, threshold_usd: notificationSettings.large_advance_threshold },
    }).catch(() => {});
  }

  if (notificationSettings.daily_volume_threshold == null) return;

  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const { data: todaysAdvances } = await supabaseAdmin
    .from('advances')
    .select('amount, currency')
    .eq('status', 'completed')
    .gte('disbursed_at', dayStart.toISOString());

  const todaysVolumeUSD = (todaysAdvances || []).reduce(
    (sum, a) => sum + convertToUSD(Number(a.amount || 0), a.currency || 'KES', rates),
    0,
  );

  if (todaysVolumeUSD < notificationSettings.daily_volume_threshold) return;

  // Dedupe — only alert once per day even though this runs on every disbursement
  // after the threshold is crossed.
  const { count: alreadyNotified } = await supabaseAdmin
    .from('admin_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'system_alert')
    .eq('title', 'Daily Disbursement Volume Threshold Reached')
    .gte('created_at', dayStart.toISOString());

  if ((alreadyNotified ?? 0) > 0) return;

  void notifyAdmin({
    type: 'system_alert',
    title: 'Daily Disbursement Volume Threshold Reached',
    message: `Today's total disbursed volume (${todaysVolumeUSD.toFixed(2)} USD) has crossed the configured threshold of ${notificationSettings.daily_volume_threshold} USD.`,
    metadata: { volume_usd: todaysVolumeUSD, threshold_usd: notificationSettings.daily_volume_threshold },
  }).catch(() => {});
}

// ─── Repayment schedule helpers ──────────────────────────────────────────────

type ScheduleAdvanceInput = {
  id: string;
  employer_id: string;
  employee_id: string;
  amount: number | string | null;
  currency?: string | null;
  organization_id?: string | null;
};

// Clamp a target day-of-month to however many days that month actually has
// (e.g. payday=31 in a 30-day or 28/29-day month lands on the last day instead).
function clampDayToMonth(year: number, monthIndex: number, day: number): number {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(day, lastDay);
}

function calculateDueDate(disbursedAt: Date, payrollCycle: string | null, paydayDayOfMonth: number | null): Date {
  const cycle = payrollCycle?.toLowerCase();

  if (cycle === 'weekly') {
    const due = new Date(disbursedAt);
    due.setDate(due.getDate() + 7);
    return due;
  }
  if (cycle === 'bi-weekly' || cycle === 'biweekly') {
    const due = new Date(disbursedAt);
    due.setDate(due.getDate() + 14);
    return due;
  }

  // Monthly (default): use the employer's actual configured payday. Falls back to
  // "1st of next month" only for employers who haven't set one yet — this used to
  // be the rule for everyone, which is what caused due dates to never reflect a
  // company's real payroll date.
  if (!paydayDayOfMonth) {
    const due = new Date(disbursedAt);
    due.setMonth(due.getMonth() + 1);
    due.setDate(1);
    return due;
  }

  const year = disbursedAt.getFullYear();
  const month = disbursedAt.getMonth();
  const thisMonthPayday = new Date(year, month, clampDayToMonth(year, month, paydayDayOfMonth));

  // Disbursed before this month's payday already passed — due on that same payday.
  // Otherwise this month's payroll has already run, so it's due next month instead.
  if (disbursedAt.getTime() < thisMonthPayday.getTime()) {
    return thisMonthPayday;
  }
  return new Date(year, month + 1, clampDayToMonth(year, month + 1, paydayDayOfMonth));
}

async function createRepaymentSchedule(
  advance: ScheduleAdvanceInput,
  disbursedAt: Date,
  supabase: typeof supabaseAdmin,
): Promise<void> {
  const { data: employer } = await supabase
    .from('employers')
    .select('payroll_cycle, payday_day_of_month, id')
    .eq('id', advance.employer_id)
    .single();

  if (!employer) throw new Error(`Employer ${advance.employer_id} not found for repayment schedule`);

  const effectivePaydayDayOfMonth = await resolveEffectivePaydayDayOfMonth(
    advance.employer_id,
    employer.payday_day_of_month,
    supabase,
  );
  const dueDate = calculateDueDate(disbursedAt, employer.payroll_cycle, effectivePaydayDayOfMonth);

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

    // No caller currently passes a local-currency amount separately from the USD
    // figure checked against the admin wallet — treat `amount` as USD for both
    // until this route has a real caller with its own currency field.
    const { data, error } = await supabaseAdmin.rpc('fund_employer_from_admin', {
      p_employer_id: employerId,
      p_admin_wallet_id: adminWallet.id,
      p_amount_usd: amount,
      p_amount_local: amount,
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

  if (error) {
    console.error('[payout-service] reserveFunds RPC failed', error);
    throw new Error('Failed to reserve funds');
  }
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
        e:employees(id, full_name, kyc_status, status:status, risk_score, employer_id, country, monthly_salary, created_at),
        er:employers(is_verified, ewa_enabled, disbursements_frozen, freeze_reason, is_defaulted, processing_fee, advance_limit_percent, min_advance_amount, cooldown_days, max_monthly_advances, weekend_access, instant_enabled, funding_model, risk_tier, funding_buffer_percent, credit_limit)
      `)
      .eq('id', advanceId)
      .maybeSingle();

    if (advanceError || !advanceRow) {
      throw new Error(`Advance not found: ${advanceError?.message || 'missing'}`);
    }

    const { platform: globalSettings, notifications: notificationSettings, risk: riskSettings, rates: exchangeRates } = await loadGlobalSettings();

    // employee_ewa_settings has no FK to advances (it relates via employees),
    // so it can't be embedded in the select above — fetch it separately.
    const { data: eesData, error: eesError } = await supabaseAdmin
      .from('employee_ewa_settings')
      .select('ewa_enabled, max_advance_percentage, max_advance_amount, min_advance_amount, cooldown_period')
      .eq('employee_id', advanceRow.employee_id)
      .maybeSingle();
    const ees = eesData as EESRow | null;

    if (eesError) {
      // Not fatal — downstream code falls back to employer-level settings via `??`.
      console.error(`[disburseAdvance] Failed to fetch employee_ewa_settings for advance ${advanceId}:`, eesError.message);
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
      created_at?: string | null;
    }

    interface EmployerRow {
      is_verified?: boolean | null;
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
      instant_enabled?: boolean | null;
      funding_model?: string | null;
      risk_tier?: string | null;
      funding_buffer_percent?: number | string | null;
      credit_limit?: number | string | null;
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
    // ees fetched separately above — already a single row or null, no unwrap needed

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
      const status = normalizeAdvanceTerminalStatus('rejected', 'disbursement_failure');
      await supabaseAdmin.from('advances').update({ status, reason: `Employer disbursements frozen: ${employer.freeze_reason}` }).eq('id', advanceId);
      throw new Error(`Employer disbursements frozen: ${employer.freeze_reason}`);
    }

    if (!employer?.ewa_enabled) {
      const status = normalizeAdvanceTerminalStatus('rejected', 'disbursement_failure');
      await supabaseAdmin.from('advances').update({ status, reason: 'EWA not enabled for this employer' }).eq('id', advanceId);
      throw new Error('EWA not enabled for employer');
    }

    // is_verified is kept live-synced to the employer's actual KYC rollup
    // (trg_sync_employer_kyc_to_live) independent of the employer's account
    // status, which an admin controls separately and can stay 'approved'
    // indefinitely. A KYC document rejected after the employer was already
    // approved flips this to false without touching account status — this
    // is the real money-movement chokepoint, so it must be checked here even
    // though app/api/employee-dashboard/request-advance/route.ts already
    // checks it at request-creation time (an advance can sit pending for
    // days between those two points).
    if (employer?.is_verified !== true) {
      const status = normalizeAdvanceTerminalStatus('rejected', 'disbursement_failure');
      await supabaseAdmin.from('advances').update({ status, reason: 'Employer KYC verification is not currently valid' }).eq('id', advanceId);
      throw new Error('Employer KYC verification is not currently valid');
    }

    // Employer arrears gate: if a past payday's recoupment was declined or never
    // resolved, new advances are paused for this employer's employees until it's
    // sorted out. Today's still-open prompt (payday_date === today) doesn't count
    // yet — the employer gets a same-day chance to act on it via the modal in
    // components/employer/PaydayRecoupmentModal.tsx before this blocks anything.
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: unresolvedRecoupment } = await supabaseAdmin
      .from('payday_recoupments')
      .select('id, payday_date, amount_due, currency')
      .eq('employer_id', advance.employer_id)
      .in('status', ['pending_response', 'failed', 'declined'])
      .lt('payday_date', todayStr)
      .order('payday_date', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (unresolvedRecoupment) {
      const status = normalizeAdvanceTerminalStatus('rejected', 'disbursement_failure');
      const reason = `Employer has not recouped ${unresolvedRecoupment.currency} ${unresolvedRecoupment.amount_due} in arrears from ${unresolvedRecoupment.payday_date}`;
      await supabaseAdmin.from('advances').update({ status, reason }).eq('id', advanceId);
      throw new Error(reason);
    }

    // Global Settings defaults are stored in USD — convert to whatever currency
    // this employee's advance is actually denominated in before comparing.
    const localCurrency = getCurrencyFromCountry(employee?.country, advance.currency ?? 'KES');
    const treasuryCountry = normalizeCountryCode(employee?.country) ?? 'KE';
    const globalMinLocal = globalSettings.min_advance_amount != null
      ? convertFromUSD(globalSettings.min_advance_amount, localCurrency, exchangeRates)
      : undefined;
    const globalMaxLocal = globalSettings.max_advance_amount != null
      ? convertFromUSD(globalSettings.max_advance_amount, localCurrency, exchangeRates)
      : undefined;

    const checkEmployeeEligibility = async (): Promise<EligibilityCheckResult> => {
      const flags: FraudFlagInput[] = [];

      if (employee?.status !== 'Active') {
        return { eligible: false, rejectionReason: 'Employee is not active', fraudFlags: [] };
      }
      if (employee?.kyc_status !== 'approved') {
        return { eligible: false, rejectionReason: 'Employee KYC not approved', fraudFlags: [] };
      }
      if (!(ees?.ewa_enabled ?? employer?.ewa_enabled)) {
        return { eligible: false, rejectionReason: 'EWA disabled for this employee', fraudFlags: [] };
      }

      // risk_score is 0–5 where HIGHER = SAFER (confirmed against
      // app/api/admin/settings/employees/route.ts and RiskScoringClient.tsx,
      // which both treat a high score as low risk). This previously compared
      // the wrong direction — flagging/blocking the safest employees (high
      // score) as critical fraud risk while letting the riskiest ones
      // (low score) through unflagged.
      const suspendThreshold = toNumber(riskSettings.auto_suspend_threshold, 1.5);
      const mediumThreshold = toNumber(riskSettings.employee_medium_threshold, 2.5);
      if (typeof employee.risk_score === 'number' && employee.risk_score < mediumThreshold) {
        flags.push({
          flagType: 'risk_score_threshold',
          severity: employee.risk_score < suspendThreshold ? 'critical' : 'high',
          description: `Employee risk score ${employee.risk_score} is below the safe threshold of ${mediumThreshold}`,
        });
      }

      if (employee.created_at) {
        const waitDays = toNumber(globalSettings.new_employee_wait_days, 0);
        const daysSinceHire = Math.floor((Date.now() - new Date(employee.created_at).getTime()) / (1000 * 60 * 60 * 24));
        if (waitDays > 0 && daysSinceHire < waitDays) {
          return { eligible: false, rejectionReason: `New employees must wait ${waitDays} days before requesting an advance (${waitDays - daysSinceHire} remaining)`, fraudFlags: [] };
        }
      }

      let effectiveMaxPercent = toNumber(ees?.max_advance_percentage ?? employer?.advance_limit_percent ?? globalSettings.default_advance_percent, 50);
      // Risk Settings "Reduce advance limit at risk score below" — halves the
      // employee's effective percentage limit rather than blocking outright.
      const reduceLimitsThreshold = riskSettings.reduce_limits_threshold;
      if (typeof employee.risk_score === 'number' && reduceLimitsThreshold != null && employee.risk_score < reduceLimitsThreshold) {
        effectiveMaxPercent = effectiveMaxPercent / 2;
      }
      // Employer Config's Risk Tier — a coarser, employer-wide cap on top of
      // whatever the employee-level percentage resolves to. 'high' additionally
      // forces every advance through fraud review regardless of the fraud
      // engine's own verdict (handled after checkEmployeeEligibility returns).
      const RISK_TIER_MAX_PERCENT: Record<string, number> = { medium: 40, high: 25 };
      const tierCap = employer?.risk_tier ? RISK_TIER_MAX_PERCENT[employer.risk_tier] : undefined;
      if (tierCap != null) {
        effectiveMaxPercent = Math.min(effectiveMaxPercent, tierCap);
      }
      // Integer-cent arithmetic — avoids float imprecision on salary × percent
      const salaryMinor = Math.round(toNumber(employee?.monthly_salary) * 100);
      const maxAllowedMinor = Math.floor(salaryMinor * effectiveMaxPercent / 100);
      const advanceMinor = Math.round(advanceAmount * 100);
      if (advanceMinor > maxAllowedMinor) {
        const maxAllowed = maxAllowedMinor / 100;
        return { eligible: false, rejectionReason: `Requested amount exceeds limit of ${maxAllowed}`, fraudFlags: [] };
      }

      // Absolute ceiling, independent of the salary-percentage cap above. Employee
      // override > employer setting (employers has no max_advance_amount column,
      // only min) > global default (converted from USD) > hardcoded fallback.
      const effectiveMax = toNumber(ees?.max_advance_amount ?? globalMaxLocal, 1_000_000_000);
      const effectiveMaxMinor = Math.round(effectiveMax * 100);
      if (advanceMinor > effectiveMaxMinor) {
        return { eligible: false, rejectionReason: `Requested amount exceeds maximum advance amount of ${effectiveMax}`, fraudFlags: [] };
      }

      const effectiveMin = toNumber(ees?.min_advance_amount ?? employer?.min_advance_amount ?? globalMinLocal, 500);
      const effectiveMinMinor = Math.round(effectiveMin * 100);
      if (advanceMinor < effectiveMinMinor) {
        return { eligible: false, rejectionReason: `Amount below minimum of ${effectiveMin}`, fraudFlags: [] };
      }

      const isWeekend = [0, 6].includes(new Date().getDay());
      const weekendAllowed = employer?.weekend_access ?? globalSettings.weekend_advances_enabled ?? false;
      if (isWeekend && !weekendAllowed) {
        return { eligible: false, rejectionReason: 'Advances not permitted on weekends for this employer', fraudFlags: [] };
      }

      const cooldownDays = toNumber(ees?.cooldown_period ?? employer?.cooldown_days ?? globalSettings.default_cooldown_days, 7);
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

      const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
      const daySelect = await supabaseAdmin
        .from('advances')
        .select('id', { count: 'exact', head: true })
        .eq('employee_id', advance.employee_id)
        .in('status', ['completed', 'processing'])
        .gte('created_at', dayStart.toISOString());

      const dayCount = (daySelect.count as number) ?? 0;
      const maxDaily = toNumber(globalSettings.daily_advance_limit, 0);
      if (maxDaily > 0 && dayCount >= maxDaily) {
        return { eligible: false, rejectionReason: `Daily advance request limit of ${maxDaily} reached`, fraudFlags: [] };
      }

      const maxMonthly = toNumber(employer?.max_monthly_advances ?? globalSettings.monthly_advance_limit, 2);
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

      if (employer?.risk_tier === 'high') {
        flags.push({ flagType: 'high_risk_employer_tier', severity: 'high', description: 'Employer is on the High risk tier — every advance requires manual review' });
      }

      return { eligible: flags.length === 0 || flags.every(f => f.severity === 'low'), fraudFlags: flags };
    };

    const eligibility = await checkEmployeeEligibility();
    if (!eligibility.eligible && eligibility.rejectionReason) {
      const status = normalizeAdvanceTerminalStatus('rejected', 'disbursement_failure');
      await supabaseAdmin.from('advances').update({ status, reason: eligibility.rejectionReason }).eq('id', advanceId);
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

    // Feature gates: employer-level instant_enabled already applies to mobile
    // money specifically; bank transfers have no per-employer toggle, only the
    // platform-wide Global Settings switch.
    if (paymentMethod?.method_type === 'mobile_money') {
      const instantAllowed = (employer?.instant_enabled ?? true) && (globalSettings.instant_mobile_enabled ?? true);
      if (!instantAllowed) {
        const status = normalizeAdvanceTerminalStatus('rejected', 'disbursement_failure');
        await supabaseAdmin.from('advances').update({ status, reason: 'Mobile money disbursements are currently disabled' }).eq('id', advanceId);
        throw new Error('Mobile money disbursements are currently disabled');
      }
    } else if (paymentMethod?.method_type === 'bank_account') {
      if (!(globalSettings.bank_transfers_enabled ?? true)) {
        const status = normalizeAdvanceTerminalStatus('rejected', 'disbursement_failure');
        await supabaseAdmin.from('advances').update({ status, reason: 'Bank transfer disbursements are currently disabled' }).eq('id', advanceId);
        throw new Error('Bank transfer disbursements are currently disabled');
      }
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

    // account_number/phone_number on payment_methods are always null post-insert —
    // a DB trigger nulls the plaintext columns and stores ciphertext in
    // account_number_encrypted/phone_number_encrypted. Must decrypt via RPC, same
    // as lib/paymentMethodsService.ts's listPaymentMethods().
    const { PII_ENCRYPTION_KEY } = getEnv();
    const { data: piiRows, error: piiError } = await supabaseAdmin.rpc('get_payment_method_pii', {
      p_payment_method_id: pm.id,
      p_key: PII_ENCRYPTION_KEY,
    });

    if (piiError || !piiRows?.[0]) {
      await supabaseAdmin.from('advances').update({ status: 'failed', reason: 'Could not retrieve payment method details' }).eq('id', advanceId);
      throw new Error('Could not retrieve payment method details');
    }

    const payoutMethod = (pm.method_type === 'mobile_money') ? PayoutMethod.MOBILE_MONEY : PayoutMethod.BANK;
    let account = pm.method_type === 'bank_account' ? piiRows[0].account_number : piiRows[0].phone_number;

    if (!account) {
      await supabaseAdmin.from('advances').update({ status: 'failed', reason: 'Missing account for payout' }).eq('id', advanceId);
      throw new Error('Missing account for payout');
    }

    // DusuPay requires mobile money numbers in international format (e.g. 2547...),
    // but numbers are stored/entered locally (e.g. 07...). Confirmed by hand against
    // the sandbox API: a local-format number is rejected as "could not be parsed as
    // a phone number in international format".
    if (payoutMethod === PayoutMethod.MOBILE_MONEY) {
      const dialCode = COUNTRY_PROVIDER_PREFIXES[pm.country_code ?? ''] ?? '254';
      account = formatPhoneNumber(account, dialCode);
    }

    // provider_name is now validated against payout_providers at payment-method
    // creation time, but resolveProviderCode still returns null on no match
    // (pre-existing unvalidated records, or a provider added to payout_providers
    // after the fact under a different name) — never fall back to sending
    // DusuPay a guessed code. Only resolved for mobile money — bank
    // provider_code handling is unverified and untouched here.
    const providerCode = payoutMethod === PayoutMethod.MOBILE_MONEY
      ? resolveProviderCode(pm.country_code, pm.provider_name)
      : pm.provider_name;

    if (!providerCode) {
      const reason = `Unrecognized mobile money provider "${pm.provider_name}" — cannot resolve a DusuPay provider code`;
      await supabaseAdmin.from('advances').update({ status: 'failed', reason }).eq('id', advanceId);
      throw new Error(reason);
    }

    // Validate treasury wallet has sufficient balance
    try {
      await validateTreasuryBalance(netAmount, localCurrency, treasuryCountry);
    } catch (treasuryErr) {
      if (treasuryErr instanceof TreasuryValidationError) {
        const reason = treasuryErr.message;
        await supabaseAdmin.from('advances').update({ status: 'failed', reason }).eq('id', advanceId);

        // For insufficient balance, alert the admin to top up
        if (treasuryErr.code === 'insufficient_treasury_balance') {
          void notifyAdmin({
            type: 'system_alert',
            title: 'Treasury Balance Critical',
            message: `Advance ${advanceId} cannot be disbursed: ${reason}. Please fund the ${localCurrency}-${treasuryCountry} treasury account immediately.`,
            metadata: treasuryErr.details || {},
          }).catch(() => {});
        }
        throw treasuryErr;
      }
      throw treasuryErr;
    }

    let payoutResponse;
    try {
      // Check if DusuPay has already processed this merchant reference before firing sendFunds
      let preVerified;
      try {
        preVerified = await dusupayClient.verifyTransaction(merchantReference);
      } catch {
        preVerified = null;
      }

      if (preVerified?.data?.transaction_status === PayoutStatus.COMPLETED) {
        payoutResponse = preVerified;
      } else {
        payoutResponse = await dusupayClient.sendFunds({
          merchant_reference: merchantReference,
          transaction_method: payoutMethod,
          currency: advance.currency as Currency,
          amount: netAmount,
          provider_code: providerCode,
          account_number: account,
          customer_name: employee?.full_name ?? 'EaziWage Employee',
          description: `EaziWage Advance: ${advanceId}`,
        });
      }
    } catch (err: unknown) {
      // DusuPay support confirmed merchant_reference is a true server-side
      // idempotency key: "In case you perform another request with a
      // merchant reference which has already been used, you will receive an
      // error message and that request will not even reach our end." That
      // means a duplicate submission can never cause a second real payout —
      // so on ANY failure here (network-ambiguous or an explicit rejection,
      // including a duplicate-reference rejection from a prior attempt that
      // actually succeeded), it's always safe to check DusuPay's real status
      // for this exact reference before giving up. Without this, a payout
      // that actually succeeded but whose response we never received (or
      // whose retry was rejected as a dupe precisely because the original
      // went through) would get permanently marked 'failed' in our records.
      let verified;
      let verifyErrored = false;
      try {
        verified = await dusupayClient.verifyTransaction(merchantReference);
      } catch (vErr) {
        // Verification also failed (network/timeout). This is an indeterminate
        // outcome — we cannot safely mark the advance as failed because the
        // payout may have actually succeeded. Record an explicit 'processing_unknown'
        // status so the reconciliation worker can resolve it later.
        verifyErrored = true;
        verified = null;
        console.error('[disburseAdvance] verifyTransaction threw after sendFunds error', { advanceId, merchantReference, err: vErr });
      }

      if (verified?.data?.transaction_status === PayoutStatus.COMPLETED) {
        payoutResponse = verified;
      } else {
        if (verifyErrored) {
          const reason = 'DusuPay status unknown after network error';
          // Leave reservation intact — we do not know whether money moved.
          await supabaseAdmin.from('advances').update({
            status: 'processing_unknown',
            reason,
            reference: merchantReference,
            internal_reference: verified?.data?.internal_reference ?? null,
          }).eq('id', advanceId);

          void notifyAdmin({
            type: 'system_alert',
            title: 'DusuPay: indeterminate payout (network failure)',
            message: `Advance ${advanceId} could not be verified after a network error; reconciliation required.`,
            metadata: { advance_id: advanceId, merchant_reference: merchantReference, note: 'processing_unknown' },
          }).catch(() => {});

          throw new Error(reason);
        }

        const reason = err instanceof Error ? err.message : 'DusuPay sendFunds failed';
        await supabaseAdmin.from('advances').update({ status: 'failed', reason }).eq('id', advanceId);
        throw new Error(reason);
      }
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

    const { error: treasuryDebitError } = await supabaseAdmin.rpc('record_employee_disbursement_from_treasury', {
      p_advance_id: advanceId,
      p_amount: netAmount,
      p_country_code: treasuryCountry,
      p_currency: localCurrency,
      p_reference: `DISB-${merchantReference}`,
      p_internal_reference: payoutResponse.data?.internal_reference ?? null,
    });

    if (treasuryDebitError) {
      // DusuPay confirmed the payout but the treasury ledger RPC failed.
      // Do NOT mark this advance as 'failed' or release the employer reservation —
      // money has already left our treasury and reconciliation must ensure the
      // ledger catches up. Mark an explicit 'disbursed_pending_ledger' state so
      // the reconciliation worker can retry the idempotent RPC.
      await supabaseAdmin.from('advances').update({
        status: 'disbursed_pending_ledger',
        reason: `DusuPay payout succeeded, but treasury ledger debit failed: ${treasuryDebitError.message}`,
        reference: merchantReference,
        internal_reference: payoutResponse.data?.internal_reference ?? null,
      }).eq('id', advanceId);

      void notifyAdmin({
        type: 'system_alert',
        title: 'Treasury Ledger Debit Failed — reconciliation required',
        message: `Advance ${advanceId} was accepted by DusuPay but the treasury ledger RPC failed. Manual or automatic reconciliation required.`,
        metadata: { advance_id: advanceId, merchant_reference: merchantReference, internal_reference: payoutResponse.data?.internal_reference ?? null, country: treasuryCountry, currency: localCurrency, error: treasuryDebitError.message },
      }).catch(() => {});

      // Throw so upstream callers see this as an error condition; the
      // reconciliation job will handle retrying the RPC and settling the row.
      throw new Error('Treasury ledger debit failed after DusuPay payout (disbursed_pending_ledger)');
    }

    // NOTE: employer liability is already fully recorded at funding time —
    // fund_employer_from_admin() increments employer_wallets.outstanding_liability
    // by the whole funded amount when the admin tops up the employer's wallet,
    // and reserve_employer_funds()/repay_advance_to_admin() correctly move
    // reserved_amount to gate/release that balance per-advance. There used to be
    // a call here to a non-existent `increment_employer_liability` RPC that would
    // have double-counted this same money as owed a second time per disbursement
    // (on top of what funding already recorded) had it ever been implemented —
    // removed rather than implemented for that reason. It also meant every real
    // automated disbursement was silently marked 'failed' after DusuPay had
    // already sent the money, since the RPC call always threw.

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

      // reserved_amount for this advance is normally released by repay_advance_to_admin
      // when its repayment_schedules row gets settled — with no schedule row, that
      // release never happens, permanently shrinking this employer's available balance
      // by advanceAmount even after the underlying liability is eventually recouped via
      // the payday-recoupment fallback (repay_employer_liability_to_admin, which settles
      // outstanding_liability but has no advance to tie a reservation release to).
      // Release the reservation now — outstanding_liability is untouched and still
      // correctly owed; only the "held pending disbursement" hold is being cleared,
      // since disbursement has already completed successfully above.
      const { error: releaseErr } = await supabaseAdmin.rpc('release_employer_reservation', {
        p_employer_id: advance.employer_id,
        p_amount: advanceAmount,
        p_advance_id: advanceId,
      });
      if (releaseErr) {
        console.error('[disburseAdvance] Failed to release reservation after schedule creation failure:', releaseErr);
      }

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
      metadata: { employee_id: advance.employee_id, employer_id: advance.employer_id, currency: advance.currency, treasury_country: treasuryCountry, treasury_currency: localCurrency },
    });

    void checkVolumeAlerts(advanceId, advanceAmount, localCurrency, notificationSettings, exchangeRates)
      .catch((err) => console.error('[disburseAdvance] Volume alert check failed:', err));

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