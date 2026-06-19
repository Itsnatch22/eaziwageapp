create table public.wallet_transactions (
  id uuid not null default gen_random_uuid (),
  wallet_id uuid not null,
  amount numeric(12, 2) not null,
  type text not null,
  status text not null default 'pending'::text,
  reference text null,
  internal_reference text null,
  description text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  constraint wallet_transactions_pkey primary key (id),
  constraint wallet_transactions_reference_key unique (reference),
  constraint wallet_transactions_wallet_id_fkey foreign KEY (wallet_id) references employer_wallets (id) on delete CASCADE,
  constraint wallet_transactions_status_check check (
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
  constraint wallet_transactions_type_check check (
    (
      type = any (
        array[
          'deposit'::text,
          'withdrawal'::text,
          'payout'::text,
          'refund'::text,
          'arrears_payment'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists wallet_tx_reference_idx on public.wallet_transactions using btree (reference) TABLESPACE pg_default;

create index IF not exists wallet_tx_wallet_idx on public.wallet_transactions using btree (wallet_id) TABLESPACE pg_default;

create trigger trg_notify_on_wallet_topup
after INSERT on wallet_transactions for EACH row
execute FUNCTION notify_on_wallet_topup ();