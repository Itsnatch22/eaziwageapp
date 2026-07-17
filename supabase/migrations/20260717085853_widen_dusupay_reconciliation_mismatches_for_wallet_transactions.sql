-- P4: dusupay_reconciliation_mismatches was keyed exclusively to advance_id.
-- The new employer-funding DusuPay legs (collection/payout) also need
-- reconciliation coverage for their 'processing' state, so this widens the
-- table to reference either an advance or a wallet_transaction, never both.
-- No data migration needed — table is empty live.
ALTER TABLE public.dusupay_reconciliation_mismatches
  ALTER COLUMN advance_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS wallet_transaction_id uuid;

ALTER TABLE public.dusupay_reconciliation_mismatches
  ADD CONSTRAINT dusupay_reconciliation_mismatches_one_ref_check
  CHECK ((advance_id IS NOT NULL) <> (wallet_transaction_id IS NOT NULL));
