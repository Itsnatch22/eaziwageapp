
ALTER TABLE public.advances
  ADD COLUMN IF NOT EXISTS fee_percentage numeric(5,2) NULL,
  ADD COLUMN IF NOT EXISTS net_amount numeric GENERATED ALWAYS AS (amount - COALESCE(fee_amount, 0)) STORED;

