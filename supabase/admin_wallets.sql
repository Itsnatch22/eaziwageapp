
-- 1. Create Admin Wallet to track Eaziwage's internal balance
CREATE TABLE IF NOT EXISTS public.admin_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Main Stanbic Source',
    balance NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    currency TEXT DEFAULT 'KES' NOT NULL,
    last_reconciled_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insert the default Main Wallet if it doesn't exist
INSERT INTO public.admin_wallets (name, balance, currency)
VALUES ('Main Stanbic Source', 0, 'KES')
ON CONFLICT DO NOTHING;

-- 3. Track Admin Wallet Transactions (Funding DusuPay from Stanbic, etc)
CREATE TABLE IF NOT EXISTS public.admin_wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_wallet_id UUID NOT NULL REFERENCES public.admin_wallets(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('stanbic_deposit', 'dusupay_funding', 'fee_collection', 'payout_settlement', 'adjustment')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    reference TEXT UNIQUE,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Track DusuPay Wallet Mirror (to match DusuPay API balance)
CREATE TABLE IF NOT EXISTS public.dusupay_wallet_mirror (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency TEXT NOT NULL,
    balance NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(currency)
);

-- 5. Trigger for updated_at on admin_wallets
CREATE TRIGGER update_admin_wallets_updated_at 
BEFORE UPDATE ON public.admin_wallets 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. RLS Policies (Admin Only)
ALTER TABLE public.admin_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dusupay_wallet_mirror ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_only_wallets ON public.admin_wallets
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_app_meta_data->>'role')::text IN ('admin', 'super_admin')));

CREATE POLICY admin_only_wallet_tx ON public.admin_wallet_transactions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_app_meta_data->>'role')::text IN ('admin', 'super_admin')));

CREATE POLICY admin_only_dusupay_mirror ON public.dusupay_wallet_mirror
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_app_meta_data->>'role')::text IN ('admin', 'super_admin')));

-- Function: Record a deposit from the real Stanbic Bank into the admin wallet
CREATE OR REPLACE FUNCTION public.admin_deposit(
    p_wallet_id UUID,
    p_amount NUMERIC(15, 2),
    p_reference TEXT,
    p_description TEXT
)
RETURNS VOID AS $$
BEGIN
    -- 1. Update Wallet Balance
    UPDATE public.admin_wallets
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE id = p_wallet_id;

    -- 2. Record Transaction
    INSERT INTO public.admin_wallet_transactions (
        admin_wallet_id, amount, type, status, reference, description
    ) VALUES (
        p_wallet_id, p_amount, 'stanbic_deposit', 'completed', 
        p_reference, p_description
    );
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.fund_employer_from_admin(
    p_employer_id UUID,
    p_admin_wallet_id UUID,
    p_amount NUMERIC(15, 2),
    p_description TEXT,
    p_admin_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_wallet_id UUID;
BEGIN
    -- 1. Deduct from Admin Wallet
    UPDATE public.admin_wallets
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE id = p_admin_wallet_id;

    -- 2. Record Admin Transaction
    INSERT INTO public.admin_wallet_transactions (
        admin_wallet_id, amount, type, status, description, metadata
    ) VALUES (
        p_admin_wallet_id, -p_amount, 'dusupay_funding', 'completed', 
        p_description, jsonb_build_object('employer_id', p_employer_id, 'admin_id', p_admin_id)
    );

    -- 3. Get or Create Employer Wallet
    INSERT INTO public.employer_wallets (employer_id, balance)
    VALUES (p_employer_id, 0)
    ON CONFLICT (employer_id) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_wallet_id;

    -- 4. Record Employer Deposit
    INSERT INTO public.wallet_transactions (
        wallet_id, amount, type, status, description, metadata
    ) VALUES (
        v_wallet_id, p_amount, 'deposit', 'completed', 
        p_description, jsonb_build_object('admin_id', p_admin_id)
    );

    -- Note: handle_wallet_transaction() trigger on wallet_transactions will update employer_wallets balance.
END;
$$ LANGUAGE plpgsql;

-- Function: Handle advance repayment (adds funds back to admin wallet)
CREATE OR REPLACE FUNCTION public.repay_advance_to_admin(
    p_advance_id UUID,
    p_amount NUMERIC(15, 2)
)
RETURNS VOID AS $$
DECLARE
    v_admin_wallet_id UUID;
    v_employer_id UUID;
    v_organization_id UUID;
BEGIN
    -- 1. Get advance and employer info
    SELECT employer_id, organization_id INTO v_employer_id, v_organization_id
    FROM public.advances WHERE id = p_advance_id;

    -- 2. Get the main admin wallet
    SELECT id INTO v_admin_wallet_id FROM public.admin_wallets WHERE name = 'Main Stanbic Source' LIMIT 1;

    -- 3. Update Admin Wallet
    UPDATE public.admin_wallets
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE id = v_admin_wallet_id;

    -- 4. Record Admin Transaction
    INSERT INTO public.admin_wallet_transactions (
        admin_wallet_id, amount, type, status, description, metadata
    ) VALUES (
        v_admin_wallet_id, p_amount, 'payout_settlement', 'completed', 
        'Repayment for advance ' || p_advance_id, 
        jsonb_build_object('advance_id', p_advance_id, 'employer_id', v_employer_id)
    );

    -- 5. Mark Advance as Repaid
    UPDATE public.advances
    SET status = 'repaid',
        repaid_at = NOW()
    WHERE id = p_advance_id;
END;
$$ LANGUAGE plpgsql;
