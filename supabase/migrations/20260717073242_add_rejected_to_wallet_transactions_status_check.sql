-- The employer topup-request reject route (app/api/admin/wallet/topup-requests/
-- [id]/reject/route.ts) always tried to write status='rejected' on a deliberate
-- admin denial, but the constraint only allowed pending|completed|failed — that
-- update always violated this constraint and threw, meaning admin denial of a
-- topup request was non-functional even when called directly (and there was no
-- UI control wired to it at all, separately fixed alongside this migration).
--
-- 'rejected' distinguishes a deliberate admin decision from a genuine technical
-- failure (bank rejection, DusuPay timeout), which previously both had to share
-- the same 'failed' value with no way to tell them apart later.

ALTER TABLE public.wallet_transactions DROP CONSTRAINT wallet_transactions_status_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'rejected'::text]));
