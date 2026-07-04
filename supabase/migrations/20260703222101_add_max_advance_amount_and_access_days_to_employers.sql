ALTER TABLE public.employers
  ADD COLUMN IF NOT EXISTS max_advance_amount numeric(12,2) NOT NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS advance_access_days integer[] NOT NULL DEFAULT '{1,25}';
