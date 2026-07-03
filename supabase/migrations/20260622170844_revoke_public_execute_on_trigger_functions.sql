
-- Root cause: PUBLIC has EXECUTE on all four SECURITY DEFINER trigger functions.
-- Revoking from individual roles is ineffective while PUBLIC grant exists.
-- Fix: revoke from PUBLIC, then re-grant only to roles with legitimate internal access.
-- Trigger functions are never valid RPC endpoints — they fire via triggers only.

REVOKE EXECUTE ON FUNCTION audit_payment_method_changes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION notify_on_kyc_status_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION notify_on_risk_review_request() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION notify_on_wallet_topup() FROM PUBLIC;

-- Re-grant only to internal roles. Triggers execute as the function owner (SECURITY DEFINER),
-- so the DB engine does not need anon/authenticated to call these directly.
GRANT EXECUTE ON FUNCTION audit_payment_method_changes() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION notify_on_kyc_status_change() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION notify_on_risk_review_request() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION notify_on_wallet_topup() TO postgres, service_role;

