-- Reconciliation tracking for manually-recorded Stanbic deposits.
--
-- admin_deposit() lets an admin manually credit admin_wallets.balance with a
-- free-text reference and no proof (e.g. "I deposited $5,000 at the branch").
-- That's necessary (bank deposits aren't otherwise visible to the platform in
-- real time) but it's pure trust — nothing ever checks it against what
-- Stanbic's own balance API later reports. This adds a lightweight,
-- non-blocking check: the next successful auto/manual Stanbic sync compares
-- its balance against unreconciled manual deposits and flags a mismatch for
-- admin review, instead of silently trusting or silently overwriting.

ALTER TABLE public.admin_wallet_transactions
  ADD COLUMN IF NOT EXISTS reconciled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.admin_wallet_transactions.reconciled IS
  'false only for admin_deposit() manual entries pending confirmation by a Stanbic balance sync. All other transaction types (adjustment, dusupay_funding, payout_settlement) are system/webhook-derived and reconciled by construction.';

-- admin_deposit() is the only write path for manual, unverified entries.
CREATE OR REPLACE FUNCTION public.admin_deposit(
  p_wallet_id uuid,
  p_amount numeric,
  p_reference text,
  p_description text
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.admin_wallets SET balance = balance + p_amount, updated_at = NOW() WHERE id = p_wallet_id;
  INSERT INTO public.admin_wallet_transactions (admin_wallet_id, amount, type, status, reference, description, reconciled)
  VALUES (p_wallet_id, p_amount, 'stanbic_deposit', 'completed', p_reference, p_description, false);
END;
$function$;

CREATE TABLE IF NOT EXISTS public.stanbic_deposit_reconciliation_flags (
  id                       uuid primary key default gen_random_uuid(),
  admin_wallet_id          uuid not null references public.admin_wallets(id),
  wallet_transaction_id    uuid not null references public.admin_wallet_transactions(id),
  recorded_amount          numeric not null,
  balance_before_sync      numeric not null,
  stanbic_reported_balance numeric not null,
  status                   text not null default 'pending_review'
                             check (status in ('pending_review', 'resolved', 'dismissed')),
  created_at               timestamptz not null default now(),
  resolved_at              timestamptz,
  resolved_by              uuid references auth.users(id),
  resolution_note          text,
  -- One open flag per manual deposit at a time — the sync loop re-checks
  -- unreconciled deposits every run and must not spam a duplicate flag.
  unique (wallet_transaction_id, status)
);

COMMENT ON TABLE public.stanbic_deposit_reconciliation_flags IS
  'Raised by syncStanbicBalance() when a manually-recorded Stanbic deposit (admin_wallet_transactions.reconciled = false) is still unaccounted for in Stanbic''s reported balance after a grace period. Reviewed and resolved/dismissed by an admin — never auto-resolved.';

ALTER TABLE public.stanbic_deposit_reconciliation_flags ENABLE ROW LEVEL SECURITY;

-- Admin-only table (service-role reads/writes via lib/supabaseAdmin.ts, same
-- as admin_wallet_transactions itself) — no end-user access of any kind.
CREATE POLICY "service_role_only" ON public.stanbic_deposit_reconciliation_flags
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
