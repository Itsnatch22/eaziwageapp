-- ═══════════════════════════════════════════════════════════════════════════
-- Dusupay Integration: Tables, Constraints, Wallet System, and Arrears Logic
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create audit table for Dusupay transactions
CREATE TABLE IF NOT EXISTS public.dusupay_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_reference TEXT UNIQUE NOT NULL,
    internal_reference TEXT,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL,
    amount NUMERIC(12, 2),
    currency TEXT,
    raw_payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enhance the advances table for Payout Tracking
ALTER TABLE public.advances 
ADD COLUMN IF NOT EXISTS reference TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS internal_reference TEXT,
ADD COLUMN IF NOT EXISTS disbursed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS fee_percentage NUMERIC(5, 2),
ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12, 2),
ADD COLUMN IF NOT EXISTS net_amount NUMERIC(12, 2),
ADD COLUMN IF NOT EXISTS disbursement_method TEXT;

-- 3. Create Employer Wallet System with Arrears Support
CREATE TABLE IF NOT EXISTS public.employer_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_id UUID NOT NULL REFERENCES public.employer_onboarding(id) ON DELETE CASCADE,
    balance NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    arrears_balance NUMERIC(12, 2) DEFAULT 0 NOT NULL, -- Outstanding debts from previous months
    currency TEXT DEFAULT 'KES' NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT employer_wallets_employer_id_key UNIQUE (employer_id)
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES public.employer_wallets(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL, -- Positive for deposits, negative for payouts
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'payout', 'refund', 'arrears_payment')),
    status TEXT NOT NULL DEFAULT 'pending',
    reference TEXT UNIQUE, 
    internal_reference TEXT, 
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Update the status constraint for advances
ALTER TABLE public.advances DROP CONSTRAINT IF EXISTS advances_status_check;
ALTER TABLE public.advances ADD CONSTRAINT advances_status_check 
CHECK (status = ANY (ARRAY[
    'pending'::text, 
    'approved'::text, 
    'denied'::text, 
    'rejected'::text, 
    'processing'::text, 
    'disbursed'::text, 
    'completed'::text, 
    'failed'::text, 
    'repaid'::text
]));

-- 5. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_advances_reference ON public.advances(reference);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_reference ON public.wallet_transactions(reference);

-- ═══════════════════════════════════════════════════════════════════════════
-- Wallet Update Trigger Function (V2 - Includes Arrears Logic)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_wallet_transaction()
RETURNS TRIGGER AS $$
DECLARE
    v_arrears NUMERIC(12, 2);
    v_deposit NUMERIC(12, 2);
    v_to_arrears NUMERIC(12, 2);
    v_to_balance NUMERIC(12, 2);
BEGIN
    -- Only process completed transactions
    IF (NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status != 'completed')) THEN
        
        -- Handle Deposits with Arrears Check
        IF (NEW.type = 'deposit') THEN
            -- Get current arrears
            SELECT arrears_balance INTO v_arrears 
            FROM public.employer_wallets WHERE id = NEW.wallet_id;

            v_deposit := NEW.amount;

            IF (v_arrears > 0) THEN
                -- Calculate how much goes to arrears vs balance
                v_to_arrears := LEAST(v_arrears, v_deposit);
                v_to_balance := v_deposit - v_to_arrears;

                UPDATE public.employer_wallets
                SET balance = balance + v_to_balance,
                    arrears_balance = arrears_balance - v_to_arrears,
                    updated_at = NOW()
                WHERE id = NEW.wallet_id;
            ELSE
                UPDATE public.employer_wallets
                SET balance = balance + NEW.amount,
                    updated_at = NOW()
                WHERE id = NEW.wallet_id;
            END IF;

        -- Handle Payouts (Decreases balance)
        ELSIF (NEW.type = 'payout') THEN
            UPDATE public.employer_wallets
            SET balance = balance + NEW.amount, -- NEW.amount is negative for payouts
                updated_at = NOW()
            WHERE id = NEW.wallet_id;

        -- Handle direct Arrears Payments
        ELSIF (NEW.type = 'arrears_payment') THEN
            UPDATE public.employer_wallets
            SET arrears_balance = arrears_balance - NEW.amount,
                updated_at = NOW()
            WHERE id = NEW.wallet_id;
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- Cron/Background Task Mockup: Calculate Arrears
-- Logic: At the end of the month, any 'completed' but NOT 'repaid' advances 
-- from the previous month are moved to arrears.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.calculate_monthly_arrears(p_employer_id UUID, p_month_offset INTEGER DEFAULT 1)
RETURNS VOID AS $$
DECLARE
    v_unpaid_total NUMERIC(12, 2);
    v_wallet_id UUID;
BEGIN
    -- 1. Calculate sum of un-repaid advances from the target month
    SELECT COALESCE(SUM(amount), 0) INTO v_unpaid_total
    FROM public.advances
    WHERE employer_id = p_employer_id
      AND status = 'completed'
      AND created_at < date_trunc('month', now())
      AND repaid_at IS NULL;

    -- 2. Add to arrears_balance
    IF (v_unpaid_total > 0) THEN
        UPDATE public.employer_wallets
        SET arrears_balance = arrears_balance + v_unpaid_total,
            updated_at = NOW()
        WHERE employer_id = p_employer_id
        RETURNING id INTO v_wallet_id;

        -- 3. Mark those advances as 'overdue' (optional, needs status update)
    END IF;
END;
$$ LANGUAGE plpgsql;
