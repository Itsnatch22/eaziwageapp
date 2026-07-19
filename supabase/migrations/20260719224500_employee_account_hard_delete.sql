-- Real employee account deletion. Today's "Delete Account" only sets
-- profiles.is_active = false and leaves every table (KYC documents,
-- national ID, bank/mobile money details, transaction history) intact
-- forever — despite the UI telling the user this is permanent and
-- irreversible. This closes that gap.
--
-- Constraints that shape this design (confirmed live against the schema
-- before writing this):
--   - No FK references auth.users anywhere in public.* — auth.users deletion
--     (done at the app layer via supabase.auth.admin.deleteUser) cascades
--     nothing, so every table below must be handled explicitly first.
--   - advances/repayment_schedules/fraud_flags reference employees with
--     RESTRICT/NO ACTION — employees and employee_onboarding CANNOT be hard
--     row-deleted for anyone with advance history (the entire point of the
--     product), so they're anonymized in place instead, never DELETEd.
--   - advances.payment_method_id → payment_methods is NO ACTION, so a
--     payment_methods row referenced by a real advance can't be deleted
--     either — its PII is nulled in place and the advance's FK pointer is
--     cleared instead.
--   - Financial/compliance records (advances, repayment_schedules,
--     fraud_flags, fraud_alerts, earnings_snapshots, payment_method_audit)
--     are never touched beyond FK-pointer nulling and PII redaction inside
--     payment_method_audit's jsonb snapshots — these are the AML/tax audit
--     trail and are deliberately retained.
--   - account_deletion_events is the evidence the deletion request
--     happened; this function never touches it (the API route inserts into
--     it separately, before calling this function).
--   - Storage objects (employee-kyc-documents, avatars buckets) are NOT
--     handled here — Storage isn't reachable from SQL; the API route deletes
--     those via the Storage API after this function commits.
CREATE OR REPLACE FUNCTION public.delete_employee_account_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_employee_id uuid;
  v_placeholder_email text := p_user_id::text || '@deleted.eaziwage.com';
BEGIN
  SELECT id INTO v_employee_id FROM public.employees WHERE user_id = p_user_id;

  -- Payment methods: null PII in place. A live advance's NO ACTION FK can
  -- block deleting the row outright, so anonymize instead and decouple the
  -- advance's pointer to it separately below.
  UPDATE public.payment_methods
  SET account_number_encrypted = NULL,
      phone_number_encrypted = NULL,
      account_number = NULL,
      phone_number = NULL,
      account_name = NULL,
      verification_document_path = NULL,
      is_active = false,
      updated_at = now()
  WHERE employee_id = v_employee_id;

  UPDATE public.advances
  SET payment_method_id = NULL
  WHERE employee_id = v_employee_id;

  -- Pure OTP-attempt bookkeeping — no retention value.
  DELETE FROM public.payment_method_verifications
  WHERE payment_method_id IN (
    SELECT id FROM public.payment_methods WHERE employee_id = v_employee_id
  );

  -- Redact PII inside the audit snapshots but keep the audit trail itself —
  -- old rows can contain full pre-encryption plaintext account numbers.
  UPDATE public.payment_method_audit
  SET old_data = CASE WHEN old_data IS NOT NULL THEN jsonb_build_object('redacted', true) ELSE NULL END,
      new_data = CASE WHEN new_data IS NOT NULL THEN jsonb_build_object('redacted', true) ELSE NULL END
  WHERE employee_id = v_employee_id;

  -- Operational/app-state data with no compliance retention need — delete outright.
  DELETE FROM public.notifications WHERE user_id = p_user_id;
  DELETE FROM public.system_push_subscriptions WHERE user_id = p_user_id;
  DELETE FROM public.login_history WHERE user_id = p_user_id;
  DELETE FROM public.login_events WHERE user_id = p_user_id;
  DELETE FROM public.system_mfa_backup_codes WHERE user_id = p_user_id;
  DELETE FROM public.trusted_devices WHERE user_id = p_user_id;
  DELETE FROM public.password_resets WHERE user_id = p_user_id;
  DELETE FROM public.email_verifications WHERE user_id = p_user_id;
  DELETE FROM public.help_searches WHERE user_id = p_user_id;
  DELETE FROM public.user_budgets WHERE user_id = p_user_id;
  DELETE FROM public.satisfaction_feedback WHERE user_id = p_user_id;
  DELETE FROM public.satisfaction_prompt_state WHERE user_id = p_user_id;

  -- wiza_messages cascades automatically off wiza_sessions.
  DELETE FROM public.wiza_sessions
  WHERE employee_id IN (SELECT id FROM public.employee_onboarding WHERE user_id = p_user_id)
     OR employee_live_id = v_employee_id;

  -- Support tickets may reference a disputed transaction — anonymize the
  -- content rather than delete (ticket_replies stay attached, unredacted,
  -- since the reply text is the support agent's own words, not the user's).
  UPDATE public.support_tickets
  SET subject = '[deleted account]',
      message = '[deleted account]'
  WHERE user_id = p_user_id;

  -- employee_kyc_documents rows deleted here; the underlying Storage objects
  -- are removed by the API route (Storage isn't reachable from SQL).
  DELETE FROM public.employee_kyc_documents WHERE user_id = p_user_id;

  -- Anonymize employee_onboarding in place — never DELETE (referenced by
  -- wiza_sessions/employee_ewa_settings, and is the historical application
  -- record even once the live employees row is what matters operationally).
  UPDATE public.employee_onboarding
  SET full_name = 'Deleted User',
      full_name_placeholder = NULL,
      email = NULL,
      email_placeholder = NULL,
      national_id = NULL,
      date_of_birth = NULL,
      tax_id = NULL,
      bank_account = NULL,
      bank_name = NULL,
      mobile_money_provider = NULL,
      mobile_money_number = NULL,
      address_line1 = NULL,
      address_line2 = NULL,
      city = NULL,
      postal_code = NULL,
      face_id = NULL,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Anonymize employees in place — RESTRICT/NO ACTION from
  -- advances/repayment_schedules/fraud_flags means this row cannot be
  -- DELETEd for anyone with financial history; email/full_name/phone are
  -- NOT NULL, so placeholders are used instead of NULL.
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.employees
    SET full_name = 'Deleted User',
        email = v_placeholder_email,
        phone = 'N/A',
        status = 'Inactive',
        id_document_front_path = NULL,
        id_document_back_path = NULL,
        address_proof_path = NULL,
        bank_statement_path = NULL,
        employment_contract_path = NULL,
        payslip_1_path = NULL,
        payslip_2_path = NULL,
        selfie_path = NULL,
        updated_at = now()
    WHERE id = v_employee_id;
  END IF;

  -- Anonymize profiles in place — this IS the auth.users-linked identity
  -- row; email/full_name/phone are NOT NULL, so placeholders are used.
  -- is_active = false also matches proxy.ts's existing dashboard-access gate
  -- as a defense in depth, even though auth.users deletion (done separately
  -- by the API route, after this function commits) is the real access cutoff.
  UPDATE public.profiles
  SET full_name = 'Deleted User',
      email = v_placeholder_email,
      phone = 'N/A',
      avatar_url = NULL,
      is_active = false,
      updated_at = now()
  WHERE id = p_user_id;
END;
$function$;

COMMENT ON FUNCTION public.delete_employee_account_data(uuid) IS
  'Called by app/api/employee-dashboard/delete-account/route.ts as the DB-cleanup step of real account deletion. Anonymizes employees/employee_onboarding/profiles in place (cannot be row-deleted — see function body), hard-deletes operational data with no compliance value, and redacts PII from payment_method_audit while retaining advances/repayment_schedules/fraud_flags/fraud_alerts/earnings_snapshots untouched as the AML/tax audit trail. Does NOT touch account_deletion_events, Supabase Storage objects, or the auth.users row — those are handled separately by the calling route.';
