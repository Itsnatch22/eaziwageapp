
-- Add missing currency column to advances table
ALTER TABLE public.advances
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'KES';

-- Index for payout filtering by currency (multi-country future-proofing)
CREATE INDEX IF NOT EXISTS idx_advances_currency ON public.advances(currency);

