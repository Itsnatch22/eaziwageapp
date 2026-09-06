import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';
import { z } from 'zod';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { checkRateLimit, otpConfirmLimiter } from '@/lib/rate-limit';
import { getEnv } from '@/env';
import {
  createPaymentMethod,
  listPaymentMethods,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  decryptAndMaskRow,
} from '@/lib/paymentMethodsService';
import { sendOtpSms } from '@/lib/sendOtp';
import { dbErrorResponse } from '@/lib/api-errors';
import { notifyAdmin } from '@/lib/notifications';
import { EmployeePaymentMethodChangeRequestSchema } from '@/lib/validations/route-schemas';
import { normalizeCountryCode } from '@/lib/utils';

const MAX_OTP_ATTEMPTS = 5;

function hashOtp(otp: string): string {
  const key = getEnv().PII_ENCRYPTION_KEY;
  if (!key) throw new Error('PII_ENCRYPTION_KEY not configured');
  return createHmac('sha256', key).update(otp).digest('hex');
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

    const countryCode = normalizeCountryCode(employee.country);
    if (!countryCode) {
      return NextResponse.json({ error: 'Employee country is not supported' }, { status: 422 });
    }

    const methods = await listPaymentMethods(adminSupabase, employee.id)
    return NextResponse.json({ methods, country_code: countryCode });
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

    if (body.action === 'request_change') {
      const parsed = EmployeePaymentMethodChangeRequestSchema.safeParse(body.payload ?? body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
      }

      const requestPayload = parsed.data;
      const currentMethod = await adminSupabase
        .from('payment_methods')
        .select('id, employee_id, provider_name, method_type, account_name, account_number, phone_number, is_verified')
        .eq('id', requestPayload.method_id)
        .eq('employee_id', employee.id)
        .maybeSingle();

      if (!currentMethod.data) {
        return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
      }

      const { data: requestRecord, error: requestError } = await adminSupabase
        .from('payment_method_change_requests')
        .insert({
          employee_id: employee.id,
          payment_method_id: requestPayload.method_id,
          requested_method_type: requestPayload.method_type,
          old_provider_name: currentMethod.data.provider_name,
          new_provider_name: requestPayload.new_provider_name,
          old_phone_number: currentMethod.data.phone_number,
          new_phone_number: requestPayload.new_phone_number ?? null,
          old_account_number: currentMethod.data.account_number,
          new_account_number: requestPayload.new_account_number ?? null,
          old_account_name: currentMethod.data.account_name,
          new_account_name: requestPayload.new_account_name ?? null,
          reason: requestPayload.reason ?? 'Not provided',
          status: 'pending',
        })
        .select('id')
        .single();

      if (requestError) {
        console.error('[employee/payment-methods] request_change insert error:', requestError);
        return NextResponse.json({ error: 'Failed to submit change request' }, { status: 500 });
      }

      const notificationResult = await notifyAdmin({
        type: 'bank_change',
        title: 'Payment Method Change Request',
        message: `${employee.id} requested a payment method change.`,
        metadata: {
          employee_id: employee.id,
          payment_method_id: requestPayload.method_id,
          request_id: requestRecord.id,
          reason: requestPayload.reason ?? 'Not provided',
          requested_provider: requestPayload.new_provider_name,
          request_type: 'payment_method_change',
        },
      });

      if (!notificationResult.success) {
        console.error('[employee/payment-methods] admin notification failed', notificationResult.error);
      }

      return NextResponse.json({ success: true, message: 'Change request submitted successfully. An admin will review it shortly.' });
    }

    if (body.action === 'request_verification') {
      const id = body.id as string | undefined;
      if (!id) return NextResponse.json({ error: 'Missing id for request_verification' }, { status: 400 });

      // account_number / phone_number are always null post-trigger — do not select them
      const { data: pm, error: pmError } = await adminSupabase.from('payment_methods').select('id, employee_id, is_verified').eq('id', id).maybeSingle();
      if (pmError) return dbErrorResponse('payment-methods/request_verification', pmError);
      if (!pm) return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });

      if (pm.employee_id !== employee.id) return NextResponse.json({ error: 'Payment method does not belong to you' }, { status: 403 });

      if (pm.is_verified) return NextResponse.json({ success: true, message: 'Already verified' });

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      let otpHash: string;
      try {
        otpHash = hashOtp(otp);
      } catch {
        return NextResponse.json({ error: 'OTP signing not configured' }, { status: 500 });
      }
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: insertError } = await adminSupabase
        .from('payment_method_verifications')
        .insert([{ payment_method_id: id, otp_hash: otpHash, expires_at: expiresAt }]);

      if (insertError) return dbErrorResponse('payment-methods/request_verification', insertError);

      // Decrypt PII server-side — plaintext columns are always null post-trigger
      const { PII_ENCRYPTION_KEY } = getEnv();
      const { data: piiRows, error: piiError } = await adminSupabase.rpc('get_payment_method_pii', {
        p_payment_method_id: id,
        p_key: PII_ENCRYPTION_KEY,
      });

      if (piiError || !piiRows?.[0]) {
        return NextResponse.json({ error: 'Could not retrieve payment method details' }, { status: 500 });
      }

      const phoneNumber = piiRows[0].phone_number ?? piiRows[0].account_number;

      if (!phoneNumber) {
        return NextResponse.json({ error: 'No phone number on record to send OTP' }, { status: 422 });
      }

      try {
        await sendOtpSms(phoneNumber, otp);
        console.info("[payment-methods] OTP sent via Africa's Talking"); // do not log phone number — PII
      } catch (smsErr) {
        console.error("[payment-methods] Africa's Talking SMS failed", smsErr);
        return NextResponse.json({ error: 'Failed to send verification SMS. Try again.' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (body.action === 'confirm_verification') {
      const id = body.id as string | undefined;
      const otp = body.otp as string | undefined;
      if (!id || !otp) return NextResponse.json({ error: 'Missing id or otp for confirm_verification' }, { status: 400 });

      // Rate limit OTP confirm attempts per user — hard cap regardless of what the DB says
      const otpRateResult = await checkRateLimit(otpConfirmLimiter, `otp-confirm:${user.id}`);
      if (!otpRateResult.success) {
        return NextResponse.json(
          { error: 'Too many verification attempts. Please wait before trying again.' },
          { status: 429, headers: otpRateResult.headers },
        );
      }

      // Include employee_id in the query — ownership DB-enforced
      const { data: pmRow, error: pmRowError } = await adminSupabase
        .from('payment_methods')
        .select('*')
        .eq('id', id)
        .eq('employee_id', employee.id)
        .maybeSingle();
      if (pmRowError) return dbErrorResponse('payment-methods/confirm_verification', pmRowError);
      if (!pmRow) return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
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

      // Enforce hard attempt cap — burn the OTP if exceeded so the attacker can't retry
      const currentAttempts = verification.attempts || 0;
      if (currentAttempts >= MAX_OTP_ATTEMPTS) {
        await adminSupabase
          .from('payment_method_verifications')
          .update({ is_used: true })
          .eq('id', verification.id);
        return NextResponse.json(
          { error: 'Too many incorrect attempts. Please request a new verification code.' },
          { status: 429 },
        );
      }

      let submittedHash: string;
      try {
        submittedHash = hashOtp(otp);
      } catch {
        return NextResponse.json({ error: 'OTP signing not configured' }, { status: 500 });
      }

      if (verification.otp_hash !== submittedHash) {
        await adminSupabase
          .from('payment_method_verifications')
          .update({ attempts: currentAttempts + 1 })
          .eq('id', verification.id);
        return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
      }

      await adminSupabase.from('payment_method_verifications').update({ is_used: true, used_at: new Date().toISOString() }).eq('id', verification.id);

      const { data: before } = await adminSupabase.from('payment_methods').select('id, employee_id, is_verified').eq('id', id).maybeSingle();
      const { data: updated, error: updateError } = await adminSupabase
        .from('payment_methods')
        .update({ is_verified: true })
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) return dbErrorResponse('payment-methods/confirm_verification', updateError);

      console.info('[payment-methods] Payment method verified', { id, before_is_verified: before?.is_verified, after_is_verified: updated?.is_verified, user: user.id });

      // Strip PII fields from audit — they are null post-trigger anyway, but be explicit
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { account_number: _a, phone_number: _p, ...auditSafeUpdated } = (updated ?? {}) as Record<string, unknown>;
      await adminSupabase.from('payment_method_audit').insert([{ payment_method_id: id, employee_id: before?.employee_id, action: 'verified', new_data: auditSafeUpdated }]);

      const maskedMethod = await decryptAndMaskRow(adminSupabase, (updated ?? {}) as Record<string, unknown>);
      return NextResponse.json({ success: true, method: maskedMethod });
    }

    const parse = PaymentMethodCreateSchema.safeParse(body);
    if (!parse.success) return NextResponse.json({ error: 'Invalid payload', details: parse.error.flatten() }, { status: 400 });

    const parsedPayload = parse.data;
    const countryCode = normalizeCountryCode(parsedPayload.country_code);
    if (!countryCode) {
      return NextResponse.json({ error: 'Employee country is not supported' }, { status: 422 });
    }
    const payload = { ...parsedPayload, country_code: countryCode };
    if (payload.method_type === 'mobile_money' && !payload.phone_number) {
      return NextResponse.json({ error: 'phone_number is required for mobile_money' }, { status: 400 });
    }
    if (payload.method_type === 'bank_account' && !payload.account_number) {
      return NextResponse.json({ error: 'account_number is required for bank_account' }, { status: 400 });
    }

    try {
      const created = await createPaymentMethod(adminSupabase, employee.id, payload);
      return NextResponse.json({ success: true, method: created });
    } catch (createErr) {
      // assertValidProvider's rejection is a real, user-facing 422, not a
      // 500 — distinguish it from an actual unexpected failure so the "not
      // a valid provider for your country" message reaches the employee
      // instead of a generic "Internal server error".
      if (createErr instanceof Error && createErr.message.startsWith('Selected provider is not available')) {
        return NextResponse.json({ error: createErr.message }, { status: 422 });
      }
      throw createErr;
    }
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