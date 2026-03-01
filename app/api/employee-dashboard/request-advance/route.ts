import { createRouteHandlerClient } from '@/utils/supabase/server';
import { calculateFeePercentage } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

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

  const { data: employer } = await supabase
    .from('employer_onboarding')
    .select('risk_score')
    .eq('id', employee.employer_id)
    .maybeSingle();

  const requestedAmount = Number(parsed.data.amount);
  const feePercentage = toMoney(
    calculateFeePercentage({ crsTotal: Number(employer?.risk_score ?? 3) }),
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

  return NextResponse.json(
    { message: 'Advance request submitted successfully.', data: inserted },
    { status: 201 },
  );
}
