create table public.advances (
  id uuid not null default gen_random_uuid (),
  employee_id uuid not null,
  organization_id uuid not null,
  amount numeric(12, 2) not null,
  reason text null,
  requested_at timestamp with time zone null default now(),
  status text not null default 'pending'::text,
  approved_at timestamp with time zone null,
  approved_by uuid null,
  repaid_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  cleared_by uuid null,
  employer_id uuid null,
  updated_at timestamp with time zone null default now(),
  reference text null,
  internal_reference text null,
  disbursed_at timestamp with time zone null,
  constraint advances_pkey primary key (id),
  constraint advances_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint advances_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'approved'::text,
          'denied'::text,
          'repaid'::text,
          'completed'::text,
          'failed'::text,
          'disbursed'::text,
          'processing'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create trigger trg_advances_updated_at BEFORE
update on advances for EACH row
execute FUNCTION update_updated_at ();