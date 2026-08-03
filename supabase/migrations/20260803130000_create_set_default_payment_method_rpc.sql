create or replace function public.set_default_payment_method(
  p_payment_method_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_method record;
  v_previous_default uuid;
  v_result jsonb;
begin
  select employee_id into v_employee_id
  from public.payment_methods
  where id = p_payment_method_id
  limit 1;

  if v_employee_id is null then
    raise exception 'Payment method not found' using errcode = 'P0002';
  end if;

  select * into v_method
  from public.payment_methods
  where id = p_payment_method_id
    and employee_id = v_employee_id
    and is_active = true
  limit 1;

  if v_method is null then
    raise exception 'Payment method not found' using errcode = 'P0002';
  end if;

  if coalesce(v_method.is_verified, false) = false then
    raise exception 'Payment method must be verified before it can be set as default' using errcode = 'P0003';
  end if;

  select id into v_previous_default
  from public.payment_methods
  where employee_id = v_employee_id
    and is_default = true
    and id <> p_payment_method_id
  order by created_at desc
  limit 1
  for update;

  update public.payment_methods
  set is_default = false,
      updated_at = now()
  where employee_id = v_employee_id
    and id <> p_payment_method_id;

  update public.payment_methods
  set is_default = true,
      updated_at = now()
  where id = p_payment_method_id;

  select jsonb_build_object(
    'id', v_method.id,
    'employee_id', v_method.employee_id,
    'method_type', v_method.method_type,
    'provider_name', v_method.provider_name,
    'account_name', v_method.account_name,
    'account_number', v_method.account_number,
    'phone_number', v_method.phone_number,
    'country_code', v_method.country_code,
    'is_default', true,
    'is_active', v_method.is_active,
    'is_verified', v_method.is_verified,
    'verification_status', v_method.verification_status,
    'created_at', v_method.created_at,
    'updated_at', v_method.updated_at
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.set_default_payment_method(uuid) to authenticated;
