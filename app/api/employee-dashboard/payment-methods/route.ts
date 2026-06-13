import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { z } from 'zod';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import {
  createPaymentMethod,
  listPaymentMethods,
  deletePaymentMethod,
  setDefaultPaymentMethod,
} from '@/lib/paymentMethodsService';
import { sendOtpSms } from '@/lib/sendOtp';

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function resolveEmployeeId(adminSupabase: SupabaseClient, userId: string) {
  const { data, error } = await adminSupabase
    .from('employees')
    .select('id, country')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

const PaymentMethodCreateSchema = z.object({
  country_code: z.string().min(2).max(2),
  method_type: z.enum(['mobile_money', 'bank_account']),
  provider_name: z.string().min(1),
  account_name: z.string().optional().nullable(),
  account_number: z.string().optional().nullable(),
  phone_number: z.string().optional().nullable(),
  is_default: z.boolean().optional(),
});

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const employee = await resolveEmployeeId(adminSupabase, user.id);
    if (!employee) return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });

    const methods = await listPaymentMethods(adminSupabase, employee.id)
    return NextResponse.json({ methods, country_code: employee.country });
  } catch (err) {
    console.error('Payment methods GET error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const employee = await resolveEmployeeId(adminSupabase, user.id);
    if (!employee) return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });

    const body = await req.json();

    if (body.action === 'set_default') {
      const id = body.id as string | undefined;
      if (!id) return NextResponse.json({ error: 'Missing id for set_default' }, { status: 400 });
      const updated = await setDefaultPaymentMethod(adminSupabase, employee.id, id);
      return NextResponse.json({ success: true, method: updated });
    }

    if (body.action === 'request_verification') {
      const id = body.id as string | undefined;
      if (!id) return NextResponse.json({ error: 'Missing id for request_verification' }, { status: 400 });

      const { data: pm, error: pmError } = await adminSupabase.from('payment_methods').select('*').eq('id', id).maybeSingle();
      if (pmError) return NextResponse.json({ error: pmError.message }, { status: 500 });
      if (!pm) return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });

      if (pm.employee_id !== employee.id) return NextResponse.json({ error: 'Payment method does not belong to you' }, { status: 403 });

      if (pm.is_verified) return NextResponse.json({ success: true, message: 'Already verified' });

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: insertError } = await adminSupabase
        .from('payment_method_verifications')
        .insert([{ payment_method_id: id, otp, expires_at: expiresAt }]);

      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

      // Send OTP via Twilio
      const phoneNumber = pm.phone_number ?? pm.account_number;

      if (!phoneNumber) {
        return NextResponse.json({ error: 'No phone number on record to send OTP' }, { status: 422 });
      }

      try {
        await sendOtpSms(phoneNumber, otp);
        console.info('[payment-methods] OTP sent via Twilio to', phoneNumber);
      } catch (smsErr) {
        console.error('[payment-methods] Twilio SMS failed', smsErr);
        return NextResponse.json({ error: 'Failed to send verification SMS. Try again.' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (body.action === 'confirm_verification') {
      const id = body.id as string | undefined;
      const otp = body.otp as string | undefined;
      if (!id || !otp) return NextResponse.json({ error: 'Missing id or otp for confirm_verification' }, { status: 400 });

      const { data: pmRow, error: pmRowError } = await adminSupabase.from('payment_methods').select('*').eq('id', id).maybeSingle();
      if (pmRowError) return NextResponse.json({ error: pmRowError.message }, { status: 500 });
      if (!pmRow) return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
      if (pmRow.employee_id !== employee.id) return NextResponse.json({ error: 'Payment method does not belong to you' }, { status: 403 });
      if (!pmRow.is_active) return NextResponse.json({ error: 'Payment method is inactive' }, { status: 422 });
      if (pmRow.is_verified) return NextResponse.json({ success: true, message: 'Already verified' });

      const { data: verification } = await adminSupabase
        .from('payment_method_verifications')
        .select('*')
        .eq('payment_method_id', id)
        .eq('is_used', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!verification) return NextResponse.json({ error: 'No verification request found' }, { status: 404 });
      if (new Date(verification.expires_at) < new Date()) return NextResponse.json({ error: 'OTP expired' }, { status: 410 });

      if (verification.otp !== otp) {
        await adminSupabase.from('payment_method_verifications').update({ attempts: (verification.attempts || 0) + 1 }).eq('id', verification.id);
        return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
      }

      await adminSupabase.from('payment_method_verifications').update({ is_used: true, used_at: new Date().toISOString() }).eq('id', verification.id);

      const { data: before } = await adminSupabase.from('payment_methods').select('*').eq('id', id).maybeSingle();
      const { data: updated, error: updateError } = await adminSupabase
        .from('payment_methods')
        .update({ is_verified: true })
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

      console.info('[payment-methods] Payment method verified', { id, before_is_verified: before?.is_verified, after_is_verified: updated?.is_verified, user: user.id });

      await adminSupabase.from('payment_method_audit').insert([{ payment_method_id: id, employee_id: before?.employee_id, action: 'verified', new_data: updated }]);

      return NextResponse.json({ success: true, method: updated });
    }

    const parse = PaymentMethodCreateSchema.safeParse(body);
    if (!parse.success) return NextResponse.json({ error: 'Invalid payload', details: parse.error.flatten() }, { status: 400 });

    const payload = parse.data;
    if (payload.method_type === 'mobile_money' && !payload.phone_number) {
      return NextResponse.json({ error: 'phone_number is required for mobile_money' }, { status: 400 });
    }
    if (payload.method_type === 'bank_account' && !payload.account_number) {
      return NextResponse.json({ error: 'account_number is required for bank_account' }, { status: 400 });
    }

    const created = await createPaymentMethod(adminSupabase, employee.id, payload);
    return NextResponse.json({ success: true, method: created });
  } catch (err) {
    console.error('Payment methods POST error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const methodId = searchParams.get('id');
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const employee = await resolveEmployeeId(adminSupabase, user.id);
    if (!employee) return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });

    if (!methodId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await deletePaymentMethod(adminSupabase, employee.id, methodId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Payment methods DELETE error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}