// SCHEMA NOTE: employer_onboarding uses max_advance_percentage + cooldown_period
// employers uses advance_limit_percent + cooldown_days
// Do not swap these — they are different columns on different tables
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { calculateFeePercentage } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runFraudChecks } from '@/lib/fraud-engine';
import { notifyEmployer, notifyAdmin } from '@/lib/notifications';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { advanceLimiter, checkRateLimit } from '@/lib/rate-limit';
import { requestLogger } from '@/lib/logger';

export const runtime = 'nodejs';

const requestSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  disbursement_method: z.enum(['mobile_money', 'bank_transfer']),
  payment_method_id: z.string().optional().nullable(),
});


// Use the user-scoped client — RLS on `employees` restricts to own row via user_id.
// employees table has no organization_id — that lives on employers, resolved below.
async function resolveEmployee(supabase: SupabaseClient, userId: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const adminSupabase = createAdminClient();
  const log = requestLogger('request-advance', req);

  let userId: string | null = null;
  let employeeId: string | null = null;
  let employerId: string | null = null;
  let paymentMethodId: string | null = null;
  let parsedPayload: unknown = null;

  const errorResponse = (status: number, message: string, meta?: Record<string, unknown>) => {
    log.error(message, { status, userId, employeeId, employerId, paymentMethodId, parsedPayload, ...meta });
    return NextResponse.json({ message }, { status });
  };

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      log.warn('Unauthorized access attempt', { err: authError });
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    userId = user.id;
    log.info('Request started', { userId });

    const rateLimit = await checkRateLimit(advanceLimiter, `advance:${user.id}`);
    if (!rateLimit.success) {
      return NextResponse.json(
        { message: 'Too many advance requests. Please wait before trying again.' },
        { status: 429, headers: rateLimit.headers }
      );
    }

    const raw = await req.json().catch(() => null);
    const parsed = requestSchema.safeParse(raw);
    parsedPayload = parsed.success ? parsed.data : raw;

    if (!parsed.success) {
      return errorResponse(422, 'Validation failed', { issues: parsed.error.issues });
    }

    // Resolve the live employees.id — all advance-table queries must use this FK
    const employeeRecord = await resolveEmployee(supabase, user.id);
    if (!employeeRecord) {
      return errorResponse(404, 'Employee record not found.', { note: 'resolveEmployee returned null' });
    }
    employeeId = employeeRecord.id;

    const { data: employee, error: employeeError } = await supabase
      .from('employee_onboarding')
      .select('id, employer_id, monthly_salary, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (employeeError) {
      return errorResponse(500, 'Employee onboarding lookup failed', { employeeError });
    }

    if (!employee || employee.status !== 'approved') {
      employerId = employee?.employer_id ?? null;
      return errorResponse(403, 'Your account must be approved before requesting an advance.');
    }

    employerId = employee.employer_id;

    // Use employeeId (employees.id) — advances.employee_id FK points to employees, not employee_onboarding
    const { data: existingPending, error: existingPendingError } = await supabase
      .from('advances')
      .select('id, status')
      .eq('employee_id', employeeId)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();

    if (existingPendingError) {
      return errorResponse(500, 'Pending advances lookup failed', { existingPendingError });
    }

    if (existingPending) {
      return errorResponse(409, 'You already have a pending advance request.');
    }

    const requestedAmount = Number(parsed.data.amount);

    const { data: employeeEwa, error: employeeEwaError } = await supabase
      .from('employee_ewa_settings')
      .select('ewa_enabled, max_advance_percentage, min_advance_amount, max_advance_amount, cooldown_period')
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (employeeEwaError) {
      return errorResponse(500, 'Employee EWA settings lookup failed', { employeeEwaError });
    }

    let effectiveSettings = {
      ewa_enabled: true,
      max_advance_percentage: 50,
      min_advance_amount: 500,
      max_advance_amount: 50000,
      cooldown_period: 7,
      advance_access_days: [1, 25] as [number, number],
    };

    if (employeeEwa) {
      effectiveSettings = {
        ...effectiveSettings,
        ewa_enabled: employeeEwa.ewa_enabled ?? effectiveSettings.ewa_enabled,
        max_advance_percentage: employeeEwa.max_advance_percentage ?? effectiveSettings.max_advance_percentage,
        min_advance_amount: Number(employeeEwa.min_advance_amount ?? effectiveSettings.min_advance_amount),
        max_advance_amount: Number(employeeEwa.max_advance_amount ?? effectiveSettings.max_advance_amount),
        cooldown_period: Number(employeeEwa.cooldown_period ?? effectiveSettings.cooldown_period),
      };
    }

    // employee_ewa_settings has no per-employee access-window override — this
    // policy is employer-wide only, same as the settings page — so it's
    // always read from `employers` regardless of whether a per-employee
    // override exists for the other fields above.
    const { data: employerSettings, error: employerSettingsError } = await supabase
      .from('employers')
      .select('advance_limit_percent, min_advance_amount, max_advance_amount, cooldown_days, advance_access_days')
      .eq('onboarding_id', employee.employer_id)
      .maybeSingle();

    if (employerSettingsError) {
      return errorResponse(500, 'Employer settings lookup failed', { employerSettingsError });
    }

    if (employerSettings) {
      if (!employeeEwa) {
        effectiveSettings = {
          ...effectiveSettings,
          max_advance_percentage: employerSettings.advance_limit_percent ?? effectiveSettings.max_advance_percentage,
          min_advance_amount: Number(employerSettings.min_advance_amount ?? effectiveSettings.min_advance_amount),
          max_advance_amount: Number(employerSettings.max_advance_amount ?? effectiveSettings.max_advance_amount),
          cooldown_period: Number(employerSettings.cooldown_days ?? effectiveSettings.cooldown_period),
        };
      }
      effectiveSettings.advance_access_days = Array.isArray(employerSettings.advance_access_days) && employerSettings.advance_access_days.length >= 2
        ? [Number(employerSettings.advance_access_days[0]), Number(employerSettings.advance_access_days[1])]
        : effectiveSettings.advance_access_days;
    }

    const todayOfMonth = new Date().getDate();
    const [accessFromDay, accessToDay] = effectiveSettings.advance_access_days;
    if (todayOfMonth < accessFromDay || todayOfMonth > accessToDay) {
      return errorResponse(403, `Advances can only be requested between day ${accessFromDay} and day ${accessToDay} of the month.`);
    }

    if (effectiveSettings.ewa_enabled === false) {
      return errorResponse(403, 'EWA access has been disabled for your account.');
    }

    if (requestedAmount < effectiveSettings.min_advance_amount) {
      return errorResponse(422, `Requested amount is below the minimum allowed of ${effectiveSettings.min_advance_amount}.`);
    }
    if (requestedAmount > effectiveSettings.max_advance_amount) {
      return errorResponse(422, `Requested amount exceeds the maximum allowed of ${effectiveSettings.max_advance_amount}.`);
    }

    if (employee.monthly_salary && effectiveSettings.max_advance_percentage) {
      const cap = (Number(employee.monthly_salary) * Number(effectiveSettings.max_advance_percentage)) / 100;
      if (requestedAmount > cap) {
        return errorResponse(422, `Requested amount exceeds your percentage limit (${effectiveSettings.max_advance_percentage}% of monthly salary = ${cap}).`);
      }
    }

    if (effectiveSettings.cooldown_period > 0) {
      // Use employeeId (employees.id) — same FK issue as the pending check above
      const { data: lastAdvance, error: lastAdvanceError } = await supabase
        .from('advances')
        .select('requested_at, status')
        .eq('employee_id', employeeId)
        .in('status', ['approved', 'paid', 'completed'])
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastAdvanceError) {
        return errorResponse(500, 'Last advance lookup failed', { lastAdvanceError });
      }

      if (lastAdvance?.requested_at) {
        const diffDays = Math.floor((Date.now() - new Date(lastAdvance.requested_at).getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < effectiveSettings.cooldown_period) {
          return errorResponse(429, `You must wait ${effectiveSettings.cooldown_period - diffDays} more day(s) before requesting another advance.`);
        }
      }
    }

    // Pass employeeId (employees.id) so the fraud engine can query advance history correctly
    const fraudResult = await runFraudChecks({
      userId: user.id,
      employeeId,
      employerId: employee.employer_id,
      amount: requestedAmount,
    });

    if (fraudResult.isBlocked) {
      return errorResponse(403, 'Your request has been flagged by our security system. Please contact support.', { code: 'FRAUD_BLOCK' });
    }

    // Fetch risk_score from employer_onboarding for fee calculation only.
    // risk_score is KYC-time metadata, not an advance eligibility column — reading
    // from employer_onboarding here is intentional (same value promoted to employers.risk_score).
    const { data: onboardingEmployer } = await supabase
      .from('employer_onboarding')
      .select('risk_score')
      .eq('id', employee.employer_id)
      .maybeSingle();

    // Resolve the live employers row and validate it is fully configured.
    // organization_id is required for the advances.organization_id NOT NULL constraint.
    const { data: employerRecord, error: employerLookupError } = await adminSupabase
      .from('employers')
      .select('id, organization_id, status, ewa_enabled, disbursements_frozen, is_defaulted, auto_approve')
      .eq('onboarding_id', employee.employer_id)
      .maybeSingle();

    if (employerLookupError || !employerRecord) {
      return errorResponse(500, 'Failed to resolve employer record', { employerLookupError });
    }
    if (employerRecord.status !== 'approved') {
      return errorResponse(403, 'Your employer account is not yet fully activated. Please contact support.');
    }
    if (employerRecord.ewa_enabled === false) {
      return errorResponse(403, 'EWA is not currently enabled for your employer.');
    }
    if (employerRecord.disbursements_frozen) {
      return errorResponse(403, 'Disbursements are currently frozen for your employer. Please contact support.', { code: 'EMPLOYER_FROZEN' });
    }
    if (employerRecord.is_defaulted) {
      return errorResponse(403, 'Your employer account has a default. Please contact support.', { code: 'EMPLOYER_DEFAULTED' });
    }
    if (!employerRecord.organization_id) {
      return errorResponse(400, 'Your employer account is not fully configured. Please contact support.', { code: 'EMPLOYER_ORG_NOT_SET' });
    }

    // Resolve organization for currency and frozen check
    const { data: organization, error: orgError } = await adminSupabase
      .from('organizations')
      .select('id, currency, is_frozen')
      .eq('id', employerRecord.organization_id)
      .maybeSingle();

    if (orgError || !organization) {
      return errorResponse(500, 'Failed to resolve organization', { orgError, organization_id: employerRecord.organization_id });
    }
    if (organization.is_frozen) {
      return errorResponse(403, 'Platform operations are currently paused. Please contact support.', { code: 'ORG_FROZEN' });
    }

    const liveEmployerId = employerRecord.id;

    // Integer-subunit arithmetic: integer × integer has no IEEE 754 error.
    // feePct is the rate in centi-percent (e.g. 4.70% → 470); amountMinor is cents.
    // Their product stays within Number.MAX_SAFE_INTEGER for any realistic advance size.
    const feePct        = Math.round(calculateFeePercentage(Number(onboardingEmployer?.risk_score ?? 3)) * 100);
    const amountMinor   = Math.round(requestedAmount * 100);
    const feeMinor      = Math.round(amountMinor * feePct / 10000);
    const feePercentage = feePct / 100;
    const feeAmount     = feeMinor / 100;

    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    const reference = `EWA-${timestamp}-${random}`;

    paymentMethodId = parsed.data.payment_method_id || null;

    if (!paymentMethodId) {
      const { data: defaultMethod, error: defaultMethodError } = await adminSupabase
        .from('payment_methods')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('is_default', true)
        .maybeSingle();

      if (defaultMethodError) {
        return errorResponse(500, 'Default payment method lookup failed', { defaultMethodError });
      }

      if (defaultMethod) paymentMethodId = defaultMethod.id;
    }

    if (!paymentMethodId) {
      return errorResponse(400, 'No payment method selected or default found. Please add and verify a payment method.');
    }

    // Include employee_id filter in the query — ownership is DB-enforced, not just app-enforced.
    // If the payment method ID belongs to a different employee, this returns null (→ 404).
    const { data: pm, error: pmError } = await adminSupabase
      .from('payment_methods')
      .select('*')
      .eq('id', paymentMethodId)
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (pmError) return errorResponse(500, 'Payment method lookup failed', { pmError });
    if (!pm) return errorResponse(404, 'Payment method not found');

    if (!pm.is_active) return errorResponse(422, 'Payment method is inactive');
    if (!pm.is_verified) return errorResponse(422, 'Payment method is not verified');

    const pmType = pm.method_type;
    const expected = parsed.data.disbursement_method === 'mobile_money' ? 'mobile_money' : 'bank_account';
    if (pmType !== expected) {
      return errorResponse(422, 'Selected payment method type does not match chosen disbursement method');
    }

    const payload = {
      employee_id:    employeeId,
      organization_id: organization.id,       // resolved via employers.organization_id — never null here
      employer_id:    liveEmployerId,
      amount:         requestedAmount,
      currency:       organization.currency,  // from organizations, not employers (no currency col there)
      fee_percentage: feePercentage,
      fee_amount:     feeAmount,
      disbursement_method: parsed.data.disbursement_method,
      payment_method_id: paymentMethodId,
      payment_method_snapshot: {
        id:             pm.id,
        method_type:    pm.method_type,
        provider_name:  pm.provider_name,
        account_number: pm.account_number,
        phone_number:   pm.phone_number,
      },
      status:        'pending',
      auto_approved: employerRecord.auto_approve ?? false,
      reference,
      requested_at:  new Date().toISOString(),
    };

    const { data: inserted, error: insertError } = await supabase
      .from('advances')
      .insert(payload)
      .select('id, status, amount, fee_amount, net_amount, disbursement_method, reference, created_at')
      .single();

    if (insertError) {
      return errorResponse(500, 'Advance insert failed', { insertError, payload });
    }

    if (fraudResult.alerts.length > 0 && inserted) {
      await supabase
        .from('fraud_alerts')
        .update({ transaction_id: inserted.id })
        .in('id', fraudResult.alerts.map((a) => a.id));
    }

    log.info('Advance created', { userId, employeeId, employerId, advanceId: inserted.id, amount: requestedAmount });

    // Fire notifications after responding — Pusher/Resend latency must not block the employee.
    void (async () => {
      try {
        const { data: employerAdmins } = await supabase
          .from('employer_onboarding')
          .select('user_id, company_name')
          .eq('id', employee.employer_id);

        if (employerAdmins && employerAdmins.length > 0) {
          const requesterName = (user.user_metadata?.full_name as string | undefined) || user.email || 'An employee';
          await notifyEmployer({
            userId: employerAdmins[0].user_id,
            type: 'advance',
            title: 'New Advance Request',
            message: `${requesterName} has requested an advance of ${requestedAmount}. Please review it in your dashboard.`,
            metadata: { advance_id: inserted.id, amount: requestedAmount },
          });
        }

        if (fraudResult.alerts.length > 0) {
          await notifyAdmin({
            type: 'flagged_advance',
            title: 'Fraud Alert: Flagged Advance',
            message: `A new advance request (ID: ${inserted.id}) has been flagged with ${fraudResult.alerts.length} alerts.`,
            metadata: { advance_id: inserted.id, alerts: fraudResult.alerts },
          });
        }
      } catch (notifyErr) {
        log.error('Notification failed', { err: notifyErr, advanceId: inserted?.id });
      }
    })();

    return NextResponse.json(
      { message: 'Advance request submitted successfully.', data: inserted },
      { status: 201 },
    );
  } catch (err) {
    log.error('Unexpected error', { err, userId, employeeId, employerId, paymentMethodId, parsedPayload });
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
