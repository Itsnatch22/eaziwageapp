import { createRouteHandlerClient } from '@/utils/supabase/server';
import { calculateFeePercentage } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runFraudChecks } from '@/lib/fraud-engine';

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

  // ── Run Fraud Checks ────────────────────────────────────────────────────────
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

  const payload = {
    employee_id: employee.id,
    amount: requestedAmount,
    fee_percentage: feePercentage,
    fee_amount: feeAmount,
    net_amount: netAmount,
    disbursement_method: parsed.data.disbursement_method,
    status: 'pending',
    requested_at: new Date().toISOString(),
  };

  const { data: inserted, error: insertError } = await supabase
    .from('advances')
    .insert(payload)
    .select('id, status, amount, fee_amount, net_amount, disbursement_method, created_at')
    .single();

  if (insertError) {
    return NextResponse.json({ message: insertError.message }, { status: 500 });
  }

  // If alerts were generated, link them to the newly created transaction
  if (fraudResult.alerts.length > 0 && inserted) {
    await supabase
      .from('fraud_alerts')
      .update({ transaction_id: inserted.id })
      .in('id', fraudResult.alerts.map(a => a.id));
  }

  return NextResponse.json(
    { message: 'Advance request submitted successfully.', data: inserted },
    { status: 201 },
  );
}
