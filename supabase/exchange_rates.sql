CREATE TABLE public.exchange_rates (
  currency_code text PRIMARY KEY,
  rate_to_usd numeric(12, 6) NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);
