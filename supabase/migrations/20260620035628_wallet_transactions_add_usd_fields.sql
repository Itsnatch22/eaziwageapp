
-- Add USD tracking fields to wallet_transactions
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS usd_amount numeric(18, 6),
  ADD COLUMN IF NOT EXISTS rate_snapshot numeric(18, 6),
  ADD COLUMN IF NOT EXISTS local_currency text;

-- Backfill existing KES pending top-up requests using current exchange rate
UPDATE public.wallet_transactions
SET
  local_currency = 'KES',
  rate_snapshot = 129.500000,
  usd_amount = ROUND((amount / 129.500000)::numeric, 6)
WHERE type = 'deposit'
  AND status = 'pending'
  AND usd_amount IS NULL;

