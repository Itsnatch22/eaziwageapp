import { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentMethodCreate, PaymentMethod } from './paymentTypes';

export async function createPaymentMethod(supabaseClient: SupabaseClient, employeeId: string, payload: PaymentMethodCreate) {
  // enforce ownership and basic validation should be done by caller
  // If is_default, unset other defaults in a transaction
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

  // if this was set as default, ensure uniqueness
  if (payload.is_default) {
    await supabaseClient
      .from('payment_methods')
      .update({ is_default: false })
      .neq('id', data.id)
      .eq('employee_id', employeeId);
  }

  // insert audit log
  await supabaseClient
    .from('payment_method_audit')
    .insert([{ payment_method_id: data.id, employee_id: employeeId, action: 'created', new_data: data }]);

  return data as PaymentMethod;
}

export async function listPaymentMethods(supabaseClient: SupabaseClient, employeeId: string) {
  const { data, error } = await supabaseClient
    .from('payment_methods')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data as PaymentMethod[];
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
  // ensure method belongs to employee
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
