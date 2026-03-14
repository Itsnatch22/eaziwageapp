-- 1. Create Employer Wallets table
CREATE TABLE IF NOT EXISTS public.employer_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL UNIQUE REFERENCES public.employer_onboarding(id) ON DELETE CASCADE,
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  arrears_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'KES',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. Create Wallet Transactions table (Funding/Payouts)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.employer_wallets(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL, -- Positive for deposits, negative for payouts
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'payout', 'refund', 'arrears_payment')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  reference TEXT UNIQUE,
  internal_reference TEXT,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS wallet_tx_wallet_idx ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS wallet_tx_reference_idx ON public.wallet_transactions(reference);
CREATE INDEX IF NOT EXISTS employer_wallet_employer_id_idx ON public.employer_wallets(employer_id);

-- 4. Triggers for updated_at
CREATE TRIGGER update_employer_wallets_updated_at 
BEFORE UPDATE ON public.employer_wallets 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Enable RLS
ALTER TABLE public.employer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies

-- Admin can do everything
CREATE POLICY admin_all_wallets ON public.employer_wallets
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_app_meta_data->>'role')::text IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_app_meta_data->>'role')::text IN ('admin', 'super_admin')));

CREATE POLICY admin_all_wallet_tx ON public.wallet_transactions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_app_meta_data->>'role')::text IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_app_meta_data->>'role')::text IN ('admin', 'super_admin')));

-- Employers can view their own wallet and transactions
CREATE POLICY employer_view_own_wallet ON public.employer_wallets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.employer_onboarding 
    WHERE public.employer_onboarding.id = public.employer_wallets.employer_id 
    AND public.employer_onboarding.user_id = auth.uid()
  ));

CREATE POLICY employer_view_own_wallet_tx ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.employer_wallets 
    JOIN public.employer_onboarding ON public.employer_onboarding.id = public.employer_wallets.employer_id
    WHERE public.employer_wallets.id = public.wallet_transactions.wallet_id 
    AND public.employer_onboarding.user_id = auth.uid()
  ));
