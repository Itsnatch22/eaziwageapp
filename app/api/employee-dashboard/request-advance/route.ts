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

  const organizationId = profile?.organization_id ?? employee.employer_id;
  if (profileError || !organizationId) {
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
        title: '⚠️ Fraud Alert: Flagged Advance',
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
