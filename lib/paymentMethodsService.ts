import { SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import type { PaymentMethodCreate, PaymentMethod } from './paymentTypes';

function maskPii(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length > 4 ? `•••• ${value.slice(-4)}` : value;
}

export async function createPaymentMethod(supabaseClient: SupabaseClient, employeeId: string, payload: PaymentMethodCreate) {

  const { data, error } = await supabaseClient
    .from('payment_methods')
    .insert([{
      ...payload,
      employee_id: employeeId,
      is_active: true,
    }])
    .select('*')
    .single();

  if (error) throw new Error(error.message);

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
    await supabaseClient
      .from('payment_methods')
      .update({ is_default: false })
      .neq('id', data.id)
      .eq('employee_id', employeeId);
  }

  // Strip PII from audit — account_number/phone_number are null post-trigger but be explicit
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { account_number: _a, phone_number: _p, ...auditSafeData } = data as Record<string, unknown>;
  await supabaseClient
    .from('payment_method_audit')
    .insert([{ payment_method_id: data.id, employee_id: employeeId, action: 'created', new_data: auditSafeData }]);

  return data as PaymentMethod;
}

export async function listPaymentMethods(supabaseClient: SupabaseClient, employeeId: string) {
  const { data, error } = await supabaseClient
    .from('payment_methods')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

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
  if (error) throw new Error(error.message);
  return data as PaymentMethod | null;
}

export async function setDefaultPaymentMethod(supabaseClient: SupabaseClient, employeeId: string, id: string) {

  const { data: method } = await supabaseClient
    .from('payment_methods')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!method || method.employee_id !== employeeId) {
    throw new Error('Payment method not found');
  }

  const { error: unsetError } = await supabaseClient
    .from('payment_methods')
    .update({ is_default: false })
    .eq('employee_id', employeeId);

  if (unsetError) throw new Error(unsetError.message);

  const { data: updated, error } = await supabaseClient
    .from('payment_methods')
    .update({ is_default: true })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  await supabaseClient.from('payment_method_audit').insert([{ payment_method_id: id, employee_id: employeeId, action: 'set_default', new_data: updated }]);

  return updated as PaymentMethod;
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

  const { error } = await supabaseClient
    .from('payment_methods')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);

  await supabaseClient.from('payment_method_audit').insert([{ payment_method_id: id, employee_id: employeeId, action: 'deleted', old_data: method }]);

  return true;
}
