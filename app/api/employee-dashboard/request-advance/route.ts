import { createRouteHandlerClient } from '@/utils/supabase/server';
import { calculateFeePercentage } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runFraudChecks } from '@/lib/fraud-engine';
import { notifyEmployer, notifyAdmins } from '@/lib/notifications';

export const runtime = 'nodejs';

const requestSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  disbursement_method: z.enum(['mobile_money', 'bank_transfer']),
});

const toMoney = (value: number) => Math.round(value * 100) / 100;

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ message: profileError.message }, { status: 500 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: 'Validation failed',
        detail: parsed.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
      { status: 422 },
    );
  }

  const { data: employee, error: employeeError } = await supabase
    .from('employee_onboarding')
    .select('id, employer_id, monthly_salary, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (employeeError) {
    return NextResponse.json({ message: employeeError.message }, { status: 500 });
  }

  if (!employee || employee.status !== 'approved') {
    return NextResponse.json(
      { message: 'Your account must be approved before requesting an advance.' },
      { status: 403 },
    );
  }

  let organizationId = profile?.organization_id ?? null;
  if (!organizationId) {
    const { data: employeeOrg, error: employeeOrgError } = await supabase
      .from('employees')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (employeeOrgError) {
      return NextResponse.json({ message: employeeOrgError.message }, { status: 500 });
    }

    organizationId = employeeOrg?.organization_id ?? null;
  }

  if (!organizationId) {
    return NextResponse.json(
      { message: 'Organization not found for this user.' },
      { status: 400 },
    );
  }

  const { data: existingPending } = await supabase
    .from('advances')
    .select('id, status')
    .eq('employee_id', employee.id)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();

  if (existingPending) {
    return NextResponse.json(
      { message: 'You already have a pending advance request.' },
      { status: 409 },
    );
  }

  const requestedAmount = Number(parsed.data.amount);

  // Fetch per-employee EWA settings, fallback to employer onboarding settings
  const { data: employeeEwa } = await supabase
    .from('employee_ewa_settings')
    .select('ewa_enabled, max_advance_percentage, min_advance_amount, max_advance_amount, cooldown_period')
    .eq('employee_onboarding_id', employee.id)
    .maybeSingle();

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
      max_advance_percentage:
        employeeEwa.max_advance_percentage ?? effectiveSettings.max_advance_percentage,
      min_advance_amount: Number(employeeEwa.min_advance_amount ?? effectiveSettings.min_advance_amount),
      max_advance_amount: Number(employeeEwa.max_advance_amount ?? effectiveSettings.max_advance_amount),
      cooldown_period: Number(employeeEwa.cooldown_period ?? effectiveSettings.cooldown_period),
    };
  } else {
    const { data: employerOnboarding } = await supabase
      .from('employer_onboarding')
      .select('max_advance_percentage, min_advance_amount, max_advance_amount, cooldown_period, risk_score')
      .eq('id', employee.employer_id)
      .maybeSingle();

    if (employerOnboarding) {
      effectiveSettings = {
        ...effectiveSettings,
        max_advance_percentage: employerOnboarding.max_advance_percentage ?? effectiveSettings.max_advance_percentage,
        min_advance_amount: Number(employerOnboarding.min_advance_amount ?? effectiveSettings.min_advance_amount),
        max_advance_amount: Number(employerOnboarding.max_advance_amount ?? effectiveSettings.max_advance_amount),
        cooldown_period: Number(employerOnboarding.cooldown_period ?? effectiveSettings.cooldown_period),
      };
    }
  }

  // Enforce EWA enabled/disabled
  if (effectiveSettings.ewa_enabled === false) {
    return NextResponse.json({ message: 'EWA access has been disabled for your account.' }, { status: 403 });
  }

  // Enforce amount limits
  if (requestedAmount < effectiveSettings.min_advance_amount) {
    return NextResponse.json({ message: `Requested amount is below the minimum allowed of ${effectiveSettings.min_advance_amount}.` }, { status: 422 });
  }
  if (requestedAmount > effectiveSettings.max_advance_amount) {
    return NextResponse.json({ message: `Requested amount exceeds the maximum allowed of ${effectiveSettings.max_advance_amount}.` }, { status: 422 });
  }

  // Enforce percentage cap based on monthly salary if available
  if (employee.monthly_salary && effectiveSettings.max_advance_percentage) {
    const cap = (Number(employee.monthly_salary) * Number(effectiveSettings.max_advance_percentage)) / 100;
    if (requestedAmount > cap) {
      return NextResponse.json({ message: `Requested amount exceeds your percentage limit (${effectiveSettings.max_advance_percentage}% of monthly salary = ${cap}).` }, { status: 422 });
    }
  }

  // Enforce cooldown: prevent new requests within cooldown_period days from last approved/paid advance
  if (effectiveSettings.cooldown_period > 0) {
    const { data: lastAdvance } = await supabase
      .from('advances')
      .select('requested_at, status')
      .eq('employee_id', employee.id)
      .in('status', ['approved', 'paid', 'completed'])
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastAdvance && lastAdvance.requested_at) {
      const lastDate = new Date(lastAdvance.requested_at);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < effectiveSettings.cooldown_period) {
        return NextResponse.json({ message: `You must wait ${effectiveSettings.cooldown_period - diffDays} more day(s) before requesting another advance.` }, { status: 429 });
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
    return NextResponse.json(
      { 
        message: 'Your request has been flagged by our security system. Please contact support.', 
        code: 'FRAUD_BLOCK' 
      },
      { status: 403 },
    );
  }

  // Fetch employer onboarding for risk_score (if not already fetched above)
  const { data: employer } = await supabase
    .from('employer_onboarding')
    .select('risk_score')
    .eq('id', employee.employer_id)
    .maybeSingle();

  const feePercentage = toMoney(
    calculateFeePercentage(Number(employer?.risk_score ?? 3)),
  );
  const feeAmount = toMoney((requestedAmount * feePercentage) / 100);
  const netAmount = toMoney(requestedAmount - feeAmount);

  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  const reference = `EWA-${timestamp}-${random}`;

  const payload = {
    employee_id: employee.id,
    organization_id: organizationId,
    amount: requestedAmount,
    fee_percentage: feePercentage,
    fee_amount: feeAmount,
    net_amount: netAmount,
    disbursement_method: parsed.data.disbursement_method,
    status: 'pending',
    reference: reference,
    requested_at: new Date().toISOString(),
    employer_id: employee.employer_id, 
  };

  const { data: inserted, error: insertError } = await supabase
    .from('advances')
    .insert(payload)
    .select('id, status, amount, fee_amount, net_amount, disbursement_method, reference, created_at')
    .single();


  if (insertError) {
    return NextResponse.json({ message: insertError.message }, { status: 500 });
  }

  if (fraudResult.alerts.length > 0 && inserted) {
    await supabase
      .from('fraud_alerts')
      .update({ transaction_id: inserted.id })
      .in('id', fraudResult.alerts.map(a => a.id));
  }

  try {
    const { data: employerAdmins } = await supabase
      .from('employer_onboarding')
      .select('user_id, company_name')
      .eq('id', employee.employer_id);

    if (employerAdmins && employerAdmins.length > 0) {
      const emp = employerAdmins[0];
      await notifyEmployer({
        userId: emp.user_id,
        type: 'advance',
        title: 'New Advance Request',
        message: `An employee has requested an advance of ${requestedAmount}. Please review it in your dashboard.`,
        metadata: { advance_id: inserted.id, amount: requestedAmount }
      });
    }

    if (fraudResult.alerts.length > 0) {
      await notifyAdmins({
        type: 'flagged_advance',
        title: 'Fraud Alert: Flagged Advance',
        message: `A new advance request (ID: ${inserted.id}) has been flagged with ${fraudResult.alerts.length} alerts.`,
        metadata: { advance_id: inserted.id, alerts: fraudResult.alerts }
      });
    }
  } catch (notifyErr) {
    console.error('[request-advance] Notification failed:', notifyErr);
    // Continue since the transaction was successful
  }

  return NextResponse.json(
    { message: 'Advance request submitted successfully.', data: inserted },
    { status: 201 },
  );
}
