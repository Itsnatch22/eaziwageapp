import { SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import type { PaymentMethodCreate, PaymentMethod } from './paymentTypes';

function maskPii(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length > 4 ? `•••• ${value.slice(-4)}` : value;
}

// Decrypts via RPC, masks, and strips the raw ciphertext columns before a row
// is handed back to a caller that will serialize it into an API response —
// select('*') on payment_methods always includes account_number_encrypted/
// phone_number_encrypted (bytea), which must never reach the client directly.
export async function decryptAndMaskRow(
  supabaseClient: SupabaseClient,
  row: Record<string, unknown>,
): Promise<PaymentMethod> {
  const { PII_ENCRYPTION_KEY } = getEnv();
  const { data: piiRows } = await supabaseClient.rpc('get_payment_method_pii', {
    p_payment_method_id: row.id,
    p_key: PII_ENCRYPTION_KEY,
  });
  const pii = piiRows?.[0];
  const { account_number_encrypted: _ae, phone_number_encrypted: _pe, ...safeRow } = row;
  void _ae;
  void _pe;
  return {
    ...safeRow,
    account_number: maskPii(pii?.account_number ?? null),
    phone_number: maskPii(pii?.phone_number ?? null),
  } as PaymentMethod;
}

// payment_methods.method_type uses 'bank_account'; payout_providers.method_type
// uses 'bank_transfer' — the tables predate each other and were never reconciled.
const PAYOUT_PROVIDER_METHOD_TYPE: Record<PaymentMethodCreate['method_type'], string> = {
  mobile_money: 'mobile_money',
  bank_account: 'bank_transfer',
};

// Re-validates against payout_providers server-side rather than trusting the
// frontend dropdown alone — a direct API call bypasses client-side filtering
// entirely, and this table is the actual source of truth for what DusuPay can
// disburse to. Previously this was a free-text field with no validation at
// any layer, so a typo or unsupported provider name flowed straight through
// to a real payout attempt.
async function assertValidProvider(supabaseClient: SupabaseClient, payload: PaymentMethodCreate) {
  const { data, error } = await supabaseClient
    .from('payout_providers')
    .select('id')
    .eq('country_code', payload.country_code)
    .eq('method_type', PAYOUT_PROVIDER_METHOD_TYPE[payload.method_type])
    .eq('provider_name', payload.provider_name)
    .eq('enabled', true)
    .maybeSingle();

  if (error) {
    console.error('[paymentMethodsService] provider validation query failed:', error);
    throw new Error('Payment method operation failed');
  }
  if (!data) {
    throw new Error('Selected provider is not available for your country. Please choose from the list.');
  }
}

export async function createPaymentMethod(supabaseClient: SupabaseClient, employeeId: string, payload: PaymentMethodCreate) {
  await assertValidProvider(supabaseClient, payload);

  const { data, error } = await supabaseClient
    .from('payment_methods')
    .insert([{
      ...payload,
      employee_id: employeeId,
      is_active: true,
    }])
    .select('*')
    .single();

  if (error) {
    console.error('[paymentMethodsService]', error);
    throw new Error('Payment method operation failed');
  }

  // Explicitly encrypt PII via RPC — the trigger will also do this on INSERT, but we call
  // the RPC directly so the write path is self-documenting and matches employer onboarding.
  const { PII_ENCRYPTION_KEY } = getEnv();
  const { error: piiError } = await supabaseClient.rpc('upsert_payment_method_pii', {
    p_payment_method_id: data.id,
    p_account_number: payload.account_number ?? null,
    p_phone_number: payload.phone_number ?? null,
    p_key: PII_ENCRYPTION_KEY,
  });
  if (piiError) {
    console.error('[createPaymentMethod] PII encryption RPC failed:', piiError.message);
    throw new Error('Failed to encrypt payment method details');
  }

  if (payload.is_default) {
    await setDefaultPaymentMethod(supabaseClient, employeeId, data.id);
  }

  // Strip PII from audit — account_number/phone_number are null post-trigger but be explicit
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { account_number: _a, phone_number: _p, ...auditSafeData } = data as Record<string, unknown>;
  await supabaseClient
    .from('payment_method_audit')
    .insert([{ payment_method_id: data.id, employee_id: employeeId, action: 'created', new_data: auditSafeData }]);

  return decryptAndMaskRow(supabaseClient, data as Record<string, unknown>);
}

export async function listPaymentMethods(supabaseClient: SupabaseClient, employeeId: string) {
  const { data, error } = await supabaseClient
    .from('payment_methods')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('is_active', true)   
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[paymentMethodsService]', error);
    throw new Error('Payment method operation failed');
  }

  const { PII_ENCRYPTION_KEY } = getEnv();

  // Decrypt each row via RPC, then mask before returning — never expose raw PII to the client
  const methods = await Promise.all(
    (data ?? []).map(async (pm) => {
      const { data: piiRows } = await supabaseClient.rpc('get_payment_method_pii', {
        p_payment_method_id: pm.id,
        p_key: PII_ENCRYPTION_KEY,
      });
      const pii = piiRows?.[0];
      return {
        ...pm,
        account_number: maskPii(pii?.account_number ?? null),
        phone_number:   maskPii(pii?.phone_number   ?? null),
      };
    }),
  );

  return methods as PaymentMethod[];
}

export async function getPaymentMethodById(supabaseClient: SupabaseClient, id: string) {
  const { data, error } = await supabaseClient
    .from('payment_methods')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[paymentMethodsService]', error);
    throw new Error('Payment method operation failed');
  }
  return data as PaymentMethod | null;
}

export async function setDefaultPaymentMethod(supabaseClient: SupabaseClient, employeeId: string, id: string) {
  const { data: updated, error } = await supabaseClient.rpc('set_default_payment_method', {
    p_payment_method_id: id,
  });

  if (error) {
    console.error('[paymentMethodsService]', error);
    throw new Error('Payment method operation failed');
  }

  const updatedMethod = Array.isArray(updated) ? updated[0] : updated;
  if (!updatedMethod) {
    throw new Error('Payment method operation failed');
  }

  await supabaseClient.from('payment_method_audit').insert([{ payment_method_id: id, employee_id: employeeId, action: 'set_default', new_data: updatedMethod }]);

  return decryptAndMaskRow(supabaseClient, updatedMethod as Record<string, unknown>);
}

export async function deletePaymentMethod(supabaseClient: SupabaseClient, employeeId: string, id: string) {
  const { data: method } = await supabaseClient
    .from('payment_methods')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!method || method.employee_id !== employeeId) {
    throw new Error('Payment method not found');
  }

  const { data: updated, error } = await supabaseClient
    .from('payment_methods')
    .update({
      is_active: false,
      is_default: false,  // never leave a deactivated method flagged as default
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('employee_id', employeeId)
    .select('*')
    .single();

  if (error) {
    console.error('[paymentMethodsService]', error);
    throw new Error('Payment method operation failed');
  }

  await supabaseClient.from('payment_method_audit').insert([
    { payment_method_id: id, employee_id: employeeId, action: 'deactivated', old_data: method, new_data: updated },
  ]);

  return true;
}
