-- Migration: add payment_method_id and payment_method_snapshot to advances

ALTER TABLE public.advances
ADD COLUMN IF NOT EXISTS payment_method_id uuid NULL;

ALTER TABLE public.advances
ADD COLUMN IF NOT EXISTS payment_method_snapshot jsonb NULL;

create index if not exists idx_advances_payment_method_id on public.advances using btree (payment_method_id) TABLESPACE pg_default;

-- optional foreign key: not adding constraint to allow flexibility with archived methods
-- alter table public.advances add constraint advances_payment_method_id_fkey foreign key (payment_method_id) references payment_methods (id) on delete set null;
