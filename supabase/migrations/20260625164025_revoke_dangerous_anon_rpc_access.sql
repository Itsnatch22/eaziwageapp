
-- Revoke anon + authenticated access from dangerous SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.debug_decrypt(bytea, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_employee_national_id(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_employer_bank_account(uuid, text) FROM anon, authenticated;

