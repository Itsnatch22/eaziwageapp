create table public.admin_wallet_transactions (
  id uuid not null default gen_random_uuid (),
  admin_wallet_id uuid not null,
  amount numeric(15, 2) not null,
  type text not null,
  status text not null default 'pending'::text,
  reference text null,
  description text null,
  metadata jsonb null,
  created_at timestamp with time zone null default now(),
  constraint admin_wallet_transactions_pkey primary key (id),
  constraint admin_wallet_transactions_reference_key unique (reference),
  constraint admin_wallet_transactions_admin_wallet_id_fkey foreign KEY (admin_wallet_id) references admin_wallets (id) on delete CASCADE,
  constraint admin_wallet_transactions_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'completed'::text,
          'failed'::text
        ]
      )
    )
  ),
  constraint admin_wallet_transactions_type_check check (
    (
      type = any (
        array[
          'stanbic_deposit'::text,
          'dusupay_funding'::text,
          'fee_collection'::text,
          'payout_settlement'::text,
          'adjustment'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_admin_wallet_txn_created_at on public.admin_wallet_transactions using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_admin_wallet_txn_type on public.admin_wallet_transactions using btree (type) TABLESPACE pg_default;