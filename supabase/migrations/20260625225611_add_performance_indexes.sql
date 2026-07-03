
-- wallet_transactions: wallet_id lookups (wallet page, webhook)
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id
  ON public.wallet_transactions (wallet_id);

-- wallet_transactions: status filter for balance computation
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_status
  ON public.wallet_transactions (wallet_id, status);

-- fraud_flags: advance-level queries
CREATE INDEX IF NOT EXISTS idx_fraud_flags_advance_id
  ON public.fraud_flags (advance_id);

-- system_audit_logs: time-range compliance queries (CBK 5-year retention)
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_created_at
  ON public.system_audit_logs (created_at DESC);

-- system_audit_logs: per-resource audit history
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_target
  ON public.system_audit_logs (target_type, target_id);

-- dusupay_transactions: idempotency check uses both columns
CREATE INDEX IF NOT EXISTS idx_dusupay_transactions_ref_event
  ON public.dusupay_transactions (merchant_reference, event_type);

