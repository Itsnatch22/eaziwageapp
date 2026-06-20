import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { calculateFeePercentage } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runFraudChecks } from '@/lib/fraud-engine';
import { notifyEmployer, notifyAdmins } from '@/lib/notifications';
import { getEnv } from '@/env';

export const runtime = 'nodejs';

const requestSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  disbursement_method: z.enum(['mobile_money', 'bank_transfer']),
  payment_method_id: z.string().optional().nullable(),
});

const toMoney = (value: number) => Math.round(value * 100) / 100;

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// resolves employees.id (live table) from auth user id
async function resolveEmployeeId(adminSupabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await adminSupabase
    .from('employees')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.id;
}

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const adminSupabase = createAdminClient();

  // contextual variables for logging
  let userId: string | null = null;
  let employeeId: string | null = null;
  let employerId: string | null = null;
  let paymentMethodId: string | null = null;
  let parsedPayload: unknown = null;

  const errorResponse = (status: number, message: string, meta?: Record<string, unknown>) => {
    try {
      console.error('[request-advance] Error response', { message, status, userId, employeeId, employerId, paymentMethodId, payload: parsedPayload, meta });
    } catch (logErr) {
      console.error('[request-advance] Failed to log error context', logErr);
    }
    return NextResponse.json({ message }, { status });
  };

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[request-advance] Unauthorized access attempt', { authError });
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    userId = user.id;
    console.info('[request-advance] Request started', { userId, url: req.url });

    // ✅ resolve employees.id early — used for payment_methods FK
    employeeId = await resolveEmployeeId(adminSupabase, user.id);
    if (!employeeId) {
      return errorResponse(404, 'Employee record not found.', { note: 'resolveEmployeeId returned null' });
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return errorResponse(500, 'Profile lookup failed', { profileError });
    }

    const raw = await req.json().catch(() => null);
    const parsed = requestSchema.safeParse(raw);
    parsedPayload = parsed.success ? parsed.data : raw;

    if (!parsed.success) {
      return errorResponse(422, 'Validation failed', { issues: parsed.error.issues });
    }

    // employee_onboarding.id — used for EWA settings, advances, fraud checks
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


    const { data: existingPending, error: existingPendingError } = await supabase
      .from('advances')
      .select('id, status')
      .eq('employee_id', employee.id)
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
    };

    if (employeeEwa) {
      effectiveSettings = {
        ewa_enabled: employeeEwa.ewa_enabled ?? effectiveSettings.ewa_enabled,
        max_advance_percentage: employeeEwa.max_advance_percentage ?? effectiveSettings.max_advance_percentage,
        min_advance_amount: Number(employeeEwa.min_advance_amount ?? effectiveSettings.min_advance_amount),
        max_advance_amount: Number(employeeEwa.max_advance_amount ?? effectiveSettings.max_advance_amount),
        cooldown_period: Number(employeeEwa.cooldown_period ?? effectiveSettings.cooldown_period),
      };
    } else {
      // ✅ employer_onboarding has no max_advance_amount column — removed
      const { data: employerOnboarding, error: employerOnboardingError } = await supabase
        .from('employer_onboarding')
        .select('max_advance_percentage, min_advance_amount, cooldown_period, risk_score')
        .eq('id', employee.employer_id)
        .maybeSingle();

      if (employerOnboardingError) {
        return errorResponse(500, 'Employer onboarding lookup failed', { employerOnboardingError });
      }

      if (employerOnboarding) {
        effectiveSettings = {
          ...effectiveSettings,
          max_advance_percentage: employerOnboarding.max_advance_percentage ?? effectiveSettings.max_advance_percentage,
          min_advance_amount: Number(employerOnboarding.min_advance_amount ?? effectiveSettings.min_advance_amount),
          cooldown_period: Number(employerOnboarding.cooldown_period ?? effectiveSettings.cooldown_period),
          // max_advance_amount stays as hardcoded default — no column on employer_onboarding
        };
      }
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
      const { data: lastAdvance, error: lastAdvanceError } = await supabase
        .from('advances')
        .select('requested_at, status')
        .eq('employee_id', employee.id)
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

    const fraudResult = await runFraudChecks({
      userId: user.id,
      employeeId: employee.id,
      employerId: employee.employer_id,
      amount: requestedAmount,
    });

    if (fraudResult.isBlocked) {
      return errorResponse(403, 'Your request has been flagged by our security system. Please contact support.', { code: 'FRAUD_BLOCK' });
    }

    const { data: employer } = await supabase
      .from('employer_onboarding')
      .select('risk_score')
      .eq('id', employee.employer_id)
      .maybeSingle();

    // Resolve live employers.id from onboarding employer_id
    const { data: employerRecord, error: employerLookupError } = await supabase
      .from('employers')
      .select('id')
      .eq('onboarding_id', employee.employer_id)
      .maybeSingle();

    if (employerLookupError || !employerRecord) {
      return errorResponse(500, 'Failed to resolve employer record', { employerLookupError });
    }

    const liveEmployerId = employerRecord.id;

    const feePercentage = toMoney(calculateFeePercentage(Number(employer?.risk_score ?? 3)));
    const feeAmount = toMoney((requestedAmount * feePercentage) / 100);

    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    const reference = `EWA-${timestamp}-${random}`;

    // ✅ payment method lookups now use employeeId (employees.id), not employee.id (onboarding)
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

    const { data: pm, error: pmError } = await adminSupabase
      .from('payment_methods')
      .select('*')
      .eq('id', paymentMethodId)
      .maybeSingle();

    if (pmError) return errorResponse(500, 'Payment method lookup failed', { pmError });
    if (!pm) return errorResponse(404, 'Payment method not found');
    // ✅ ownership check now uses employeeId
    if (pm.employee_id !== employeeId) return errorResponse(403, 'Payment method does not belong to you');
    if (!pm.is_active) return errorResponse(422, 'Payment method is inactive');
    if (!pm.is_verified) return errorResponse(422, 'Payment method is not verified');

    const pmType = pm.method_type;
    const expected = parsed.data.disbursement_method === 'mobile_money' ? 'mobile_money' : 'bank_account';
    if (pmType !== expected) {
      return errorResponse(422, 'Selected payment method type does not match chosen disbursement method');
    }

    const payload = {
      employee_id: employeeId,
      amount: requestedAmount,
      fee_percentage: feePercentage,
      fee_amount: feeAmount,
      disbursement_method: parsed.data.disbursement_method,
      payment_method_id: paymentMethodId,
      payment_method_snapshot: {
        id: pm.id,
        method_type: pm.method_type,
        provider_name: pm.provider_name,
        account_number: pm.account_number,
        phone_number: pm.phone_number,
      },
      status: 'pending',
      reference,
      requested_at: new Date().toISOString(),
      employer_id: liveEmployerId,
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

    try {
      const { data: employerAdmins } = await supabase
        .from('employer_onboarding')
        .select('user_id, company_name')
        .eq('id', employee.employer_id);

      if (employerAdmins && employerAdmins.length > 0) {
        await notifyEmployer({
          userId: employerAdmins[0].user_id,
          type: 'advance',
          title: 'New Advance Request',
          message: `An employee has requested an advance of ${requestedAmount}. Please review it in your dashboard.`,
          metadata: { advance_id: inserted.id, amount: requestedAmount },
        });
      }

      if (fraudResult.alerts.length > 0) {
        await notifyAdmins({
          type: 'flagged_advance',
          title: 'Fraud Alert: Flagged Advance',
          message: `A new advance request (ID: ${inserted.id}) has been flagged with ${fraudResult.alerts.length} alerts.`,
          metadata: { advance_id: inserted.id, alerts: fraudResult.alerts },
        });
      }
    } catch (notifyErr) {
      console.error('[request-advance] Notification failed:', notifyErr, { userId, employeeId, employerId, insertedId: inserted?.id });
    }

    console.info('[request-advance] Advance created', { userId, employeeId, employerId, advanceId: inserted.id, amount: requestedAmount });

    return NextResponse.json(
      { message: 'Advance request submitted successfully.', data: inserted },
      { status: 201 },
    );
  } catch (err) {
    console.error('[request-advance] Unexpected error', err, { userId, employeeId, employerId, paymentMethodId, payload: parsedPayload });
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
