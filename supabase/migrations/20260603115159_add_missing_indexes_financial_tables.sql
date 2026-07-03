
-- advances
CREATE INDEX IF NOT EXISTS idx_advances_organization_id ON public.advances (organization_id);
CREATE INDEX IF NOT EXISTS idx_advances_status ON public.advances (status);
CREATE INDEX IF NOT EXISTS idx_advances_created_at ON public.advances (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advances_employee_id ON public.advances (employee_id);

-- dusupay_transactions
CREATE INDEX IF NOT EXISTS idx_dusupay_transactions_status ON public.dusupay_transactions (status);
CREATE INDEX IF NOT EXISTS idx_dusupay_transactions_created_at ON public.dusupay_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dusupay_transactions_internal_reference ON public.dusupay_transactions (internal_reference);

-- admin_wallet_transactions
CREATE INDEX IF NOT EXISTS idx_admin_wallet_txn_created_at ON public.admin_wallet_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_wallet_txn_type ON public.admin_wallet_transactions (type);

