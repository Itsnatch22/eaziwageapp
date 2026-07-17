-- P4: employer wallet top-up funding now routes through real DusuPay calls
-- (collection for prefunded employers, payout for debit_order/invoice). Both
-- legs need a way to represent "DusuPay call is in flight / outcome is
-- ambiguous" distinct from the original 'pending' (awaiting admin review)
-- and from a definitive 'failed' or 'completed' — added per the resilience
-- lesson from this session's separate idempotency trace: an ambiguous
-- network failure must never be treated the same as an explicit rejection.
ALTER TABLE public.wallet_transactions DROP CONSTRAINT wallet_transactions_status_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_status_check
  CHECK (status = ANY (ARRAY['pending'::text,'processing'::text,'completed'::text,'failed'::text,'rejected'::text]));
