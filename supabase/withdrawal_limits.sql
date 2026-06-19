create table public.withdrawal_limits (
  country_code character(2) not null,
  name text not null,
  max_withdrawable_percentage numeric(5, 2) not null,
  constraint withdrawal_limits_pkey primary key (country_code)
) TABLESPACE pg_default;