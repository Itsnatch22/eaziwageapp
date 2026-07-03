
-- These are trigger functions. They must never be callable as RPC endpoints.
-- SECURITY DEFINER + anon EXECUTE = unauthenticated superuser-privilege execution.
-- Revoking from anon (unauthenticated callers) and authenticated (direct RPC abuse).
-- postgres and service_role retain access for internal DB and server-side operations.

REVOKE EXECUTE ON FUNCTION audit_payment_method_changes() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION notify_on_kyc_status_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION notify_on_risk_review_request() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION notify_on_wallet_topup() FROM anon, authenticated;

