create table public.admin_wallets (
  id uuid not null default gen_random_uuid (),
  name text not null default 'Main Stanbic Source'::text,
  balance numeric(15, 2) not null default 0,
  currency text not null default 'KES'::text,
  last_reconciled_at timestamp with time zone null,
  updated_at timestamp with time zone null default now(),
  constraint admin_wallets_pkey primary key (id)
) TABLESPACE pg_default;

create trigger update_admin_wallets_updated_at BEFORE
update on admin_wallets for EACH row
execute FUNCTION update_updated_at_column ();