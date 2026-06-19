create table public.employee_invites (
  token text not null,
  company_id uuid null,
  expires_at timestamp without time zone null,
  used boolean null default false,
  constraint employee_invites_pkey primary key (token)
) TABLESPACE pg_default;