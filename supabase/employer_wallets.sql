create table public.employer_wallets (
  id uuid not null default gen_random_uuid (),
  employer_id uuid not null,
  balance numeric(12, 2) not null default 0,
  arrears_balance numeric(12, 2) not null default 0,
  currency text not null default 'KES'::text,
  updated_at timestamp with time zone not null default now(),
  constraint employer_wallets_pkey primary key (id),
  constraint employer_wallets_employer_id_key unique (employer_id),
  constraint employer_wallets_employer_id_fkey foreign KEY (employer_id) references employer_onboarding (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists employer_wallet_employer_id_idx on public.employer_wallets using btree (employer_id) TABLESPACE pg_default;

create trigger update_employer_wallets_updated_at BEFORE
update on employer_wallets for EACH row
execute FUNCTION update_updated_at_column ();