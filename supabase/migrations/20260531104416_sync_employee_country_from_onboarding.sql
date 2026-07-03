
CREATE OR REPLACE FUNCTION public.sync_employee_from_onboarding()
RETURNS TRIGGER AS $$
declare
  v_email text;
  v_name text;
  v_live_employer_id uuid;
  v_employment_type text;
begin
  if NEW.status = 'approved' then
    select e.id
      into v_live_employer_id
    from public.employer_onboarding eo
    join public.employers e on e.user_id = eo.user_id
    where eo.id = NEW.employer_id
    limit 1;

    if v_live_employer_id is null then
      select e.id
        into v_live_employer_id
      from public.employers e
      where e.id = NEW.employer_id
         or e.employer_id = NEW.employer_id
      limit 1;
    end if;

    if v_live_employer_id is null then
      raise exception
        'sync_employee_from_onboarding: live employer row is required. onboarding_employer_id=% employee_user_id=% onboarding_id=%',
        NEW.employer_id, NEW.user_id, NEW.id;
    end if;

    select coalesce(NEW.email, NEW.email_placeholder, p.email),
           coalesce(NEW.full_name, NEW.full_name_placeholder, p.full_name, 'Anonymous')
      into v_email, v_name
    from public.profiles p
    where p.id = NEW.user_id;

    v_email := coalesce(v_email, NEW.email, NEW.email_placeholder);
    v_name := coalesce(v_name, NEW.full_name, NEW.full_name_placeholder, 'Anonymous');

    if v_email is null then
      raise exception
        'sync_employee_from_onboarding: email is required for approved onboarding. user_id=% onboarding_id=%',
        NEW.user_id, NEW.id;
    end if;

    v_employment_type := lower(replace(coalesce(NEW.employment_type, 'full-time'), '_', '-'));

    insert into public.employees (
      user_id,
      employer_id,
      email,
      name,
      full_name,
      employee_code,
      employee_number,
      job_title,
      department,
      monthly_salary,
      employment_type,
      hire_date,
      kyc_status,
      status,
      country,
      updated_at
    )
    values (
      NEW.user_id,
      v_live_employer_id,
      v_email,
      v_name,
      v_name,
      NEW.employee_code,
      NEW.employee_code,
      NEW.job_title,
      NEW.department,
      NEW.monthly_salary,
      v_employment_type,
      NEW.start_date,
      'approved',
      'Active',
      NEW.country,
      now()
    )
    on conflict (user_id) do update set
      employer_id = excluded.employer_id,
      email = coalesce(excluded.email, public.employees.email),
      name = excluded.name,
      full_name = excluded.full_name,
      employee_code = excluded.employee_code,
      employee_number = excluded.employee_number,
      job_title = excluded.job_title,
      department = excluded.department,
      monthly_salary = excluded.monthly_salary,
      employment_type = excluded.employment_type,
      hire_date = excluded.hire_date,
      kyc_status = excluded.kyc_status,
      status = excluded.status,
      country = coalesce(excluded.country, public.employees.country),
      updated_at = now();
  end if;

  return NEW;
end;
$$ LANGUAGE plpgsql SECURITY DEFINER;

