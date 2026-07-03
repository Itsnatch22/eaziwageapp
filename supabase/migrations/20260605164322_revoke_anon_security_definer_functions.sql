
-- ============================================================
-- STEP 1: Revoke anon EXECUTE from ALL SECURITY DEFINER functions
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.unlock_account(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_admin_notification(admin_notification_type, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_employee_from_onboarding() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_employer_onboarding_approval() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_notifications(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_employer_advance_summary(uuid, timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_notifications_read_by_type(admin_notification_type) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.limit_active_password_resets() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_ticket_timestamp() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_employer_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_employee_can_read_employer_profile(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_employer_can_read_profile(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_employee_onboarding(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_has_employee_onboarding_for_employer(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_owns_employer_onboarding(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_owns_employer_record(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_message_count(uuid) FROM anon;

-- ============================================================
-- STEP 2: Re-grant ONLY what anon legitimately needs
-- increment_message_count is used by Wiza public chatbot
-- ============================================================
GRANT EXECUTE ON FUNCTION public.increment_message_count(uuid) TO anon;

-- ============================================================
-- STEP 3: Also revoke public (=X) execute where it exists
-- "=X/postgres" means the public role can execute — lock that down too
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.unlock_account(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_admin_notification(admin_notification_type, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_employee_from_onboarding() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_employer_onboarding_approval() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_notifications(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_employer_advance_summary(uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_notifications_read_by_type(admin_notification_type) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.limit_active_password_resets() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_ticket_timestamp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_employer_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_employee_can_read_employer_profile(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_employer_can_read_profile(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_can_access_employee_onboarding(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_employee_onboarding_for_employer(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_owns_employer_onboarding(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_owns_employer_record(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

