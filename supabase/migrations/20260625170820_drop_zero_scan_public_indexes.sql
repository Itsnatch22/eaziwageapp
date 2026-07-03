
-- account_deletion_events
DROP INDEX IF EXISTS idx_account_deletion_events_created_at;
DROP INDEX IF EXISTS idx_account_deletion_events_reason_category;
DROP INDEX IF EXISTS idx_account_deletion_events_user_id;

-- admin_notifications
DROP INDEX IF EXISTS idx_admin_notifications_type;
DROP INDEX IF EXISTS idx_admin_notifications_unread;

-- admin_reports
DROP INDEX IF EXISTS admin_reports_created_at_idx;
DROP INDEX IF EXISTS admin_reports_created_by_idx;
DROP INDEX IF EXISTS admin_reports_generated_at_idx;
DROP INDEX IF EXISTS admin_reports_period_idx;
DROP INDEX IF EXISTS admin_reports_status_idx;
DROP INDEX IF EXISTS admin_reports_status_type_idx;
DROP INDEX IF EXISTS admin_reports_type_idx;

-- admin_wallet_transactions
DROP INDEX IF EXISTS idx_admin_wallet_txn_created_at;
DROP INDEX IF EXISTS idx_admin_wallet_txn_type;

-- advances
DROP INDEX IF EXISTS idx_advances_currency;
DROP INDEX IF EXISTS idx_advances_organization_id;

-- blackout_periods
DROP INDEX IF EXISTS idx_blackout_periods_applies_to;
DROP INDEX IF EXISTS idx_blackout_periods_is_active;

-- blogs
DROP INDEX IF EXISTS blogs_category_idx;
DROP INDEX IF EXISTS blogs_date_idx;
DROP INDEX IF EXISTS blogs_featured_idx;
DROP INDEX IF EXISTS blogs_fts_idx;

-- communications
DROP INDEX IF EXISTS idx_communications_organization_id;

-- contacts
DROP INDEX IF EXISTS idx_contacts_created_at;
DROP INDEX IF EXISTS idx_contacts_email;
DROP INDEX IF EXISTS idx_contacts_status;

-- dashboard_contact
DROP INDEX IF EXISTS idx_dashboard_contact_email;
DROP INDEX IF EXISTS idx_dashboard_contact_submitted_at;

-- dusupay_transactions
DROP INDEX IF EXISTS idx_dusupay_transactions_created_at;
DROP INDEX IF EXISTS idx_dusupay_transactions_internal_reference;
DROP INDEX IF EXISTS idx_dusupay_transactions_status;

-- earnings_snapshots
DROP INDEX IF EXISTS idx_earnings_snapshots_organization_id;

-- email_verifications
DROP INDEX IF EXISTS idx_email_verifications_expires_at;

-- employee_ewa_settings
DROP INDEX IF EXISTS idx_employee_ewa_settings_employee_id;

-- employee_kyc_documents
DROP INDEX IF EXISTS idx_ekd_document_type;
DROP INDEX IF EXISTS idx_ekd_status;

-- employee_onboarding
DROP INDEX IF EXISTS employee_onboarding_employee_code_idx;

-- employees
DROP INDEX IF EXISTS employees_email_idx;
DROP INDEX IF EXISTS employees_organization_id_idx;
DROP INDEX IF EXISTS idx_employees_kyc_status;
DROP INDEX IF EXISTS idx_employees_risk_score;
DROP INDEX IF EXISTS idx_employees_status;

-- employer_onboarding
DROP INDEX IF EXISTS idx_employer_onboarding_email_notifications;
DROP INDEX IF EXISTS idx_employer_onboarding_settings;

-- employer_onboarding_requests
DROP INDEX IF EXISTS idx_onboarding_requests_created_at;
DROP INDEX IF EXISTS idx_onboarding_requests_employer_email;
DROP INDEX IF EXISTS idx_onboarding_requests_status;

-- employer_referrals
DROP INDEX IF EXISTS idx_employer_referrals_referred_by;
DROP INDEX IF EXISTS idx_employer_referrals_status;

-- employer_repayments
DROP INDEX IF EXISTS idx_employer_repayments_period;
DROP INDEX IF EXISTS idx_employer_repayments_status;

-- employers
DROP INDEX IF EXISTS idx_employers_advance_limit;
DROP INDEX IF EXISTS idx_employers_disbursements_frozen;
DROP INDEX IF EXISTS idx_employers_organization_id;
DROP INDEX IF EXISTS idx_employers_status;

-- failed_login_attempts
DROP INDEX IF EXISTS idx_failed_login_attempted_at;
DROP INDEX IF EXISTS idx_failed_login_email;
DROP INDEX IF EXISTS idx_failed_login_email_time;

-- fraud_flags
DROP INDEX IF EXISTS idx_fraud_flags_advance_id;
DROP INDEX IF EXISTS idx_fraud_flags_employee_id;
DROP INDEX IF EXISTS idx_fraud_flags_employee_status;
DROP INDEX IF EXISTS idx_fraud_flags_employer_id;
DROP INDEX IF EXISTS idx_fraud_flags_severity;
DROP INDEX IF EXISTS idx_fraud_flags_status;
DROP INDEX IF EXISTS idx_fraud_flags_status_severity_created;

-- help_searches
DROP INDEX IF EXISTS idx_help_searches_user_id;

-- legal_documents
DROP INDEX IF EXISTS idx_legal_documents_effective_date;
DROP INDEX IF EXISTS idx_legal_documents_type;

-- login_events
DROP INDEX IF EXISTS idx_login_events_ip_address;

-- login_history
DROP INDEX IF EXISTS idx_login_history_email;
DROP INDEX IF EXISTS idx_login_history_ip;
DROP INDEX IF EXISTS idx_login_history_logged_in_at;
DROP INDEX IF EXISTS idx_login_history_user_id;

-- newsletter_subscriptions
DROP INDEX IF EXISTS idx_newsletter_email;
DROP INDEX IF EXISTS idx_newsletter_status;

-- notifications
DROP INDEX IF EXISTS notifications_user_id_idx;

-- organizations
DROP INDEX IF EXISTS organizations_country_code_idx;
DROP INDEX IF EXISTS organizations_slug_idx;

-- partner_applications
DROP INDEX IF EXISTS idx_partner_applications_created_at;
DROP INDEX IF EXISTS idx_partner_applications_email;
DROP INDEX IF EXISTS idx_partner_applications_partner_type;
DROP INDEX IF EXISTS idx_partner_applications_status;

-- password_resets
DROP INDEX IF EXISTS idx_password_resets_token_hash;

-- payment_method_audit
DROP INDEX IF EXISTS idx_payment_method_audit_employee;
DROP INDEX IF EXISTS idx_payment_method_audit_payment_method;

-- payment_method_verifications
DROP INDEX IF EXISTS idx_payment_method_verifications_is_used;

-- payment_methods
DROP INDEX IF EXISTS idx_payment_methods_phone;

-- payroll_sync_logs
DROP INDEX IF EXISTS idx_payroll_sync_logs_upload_id;
DROP INDEX IF EXISTS idx_sync_logs_integration;

-- payroll_upload_rows
DROP INDEX IF EXISTS idx_payroll_upload_rows_live_employee_id;
DROP INDEX IF EXISTS idx_upload_rows_upload;

-- payroll_uploads
DROP INDEX IF EXISTS idx_payroll_uploads_integration_id;

-- profiles
DROP INDEX IF EXISTS idx_profiles_created_at;
DROP INDEX IF EXISTS idx_profiles_full_name;
DROP INDEX IF EXISTS idx_profiles_locked_until;
DROP INDEX IF EXISTS idx_profiles_organization_id;
DROP INDEX IF EXISTS idx_profiles_role_normalized;

-- risk_review_requests
DROP INDEX IF EXISTS idx_review_requests_status_created;

-- satisfaction_feedback
DROP INDEX IF EXISTS idx_satisfaction_feedback_advance_id;
DROP INDEX IF EXISTS idx_satisfaction_feedback_created_at;

-- subscriptions
DROP INDEX IF EXISTS subscriptions_email_idx;
DROP INDEX IF EXISTS subscriptions_product_idx;

-- support_tickets
DROP INDEX IF EXISTS idx_support_tickets_user_id;

-- system_admins
DROP INDEX IF EXISTS idx_system_admins_is_admin;

-- system_audit_logs
DROP INDEX IF EXISTS audit_action_idx;
DROP INDEX IF EXISTS idx_audit_logs_admin;
DROP INDEX IF EXISTS idx_audit_logs_created;
DROP INDEX IF EXISTS idx_audit_logs_target;
DROP INDEX IF EXISTS idx_system_audit_logs_metadata;
DROP INDEX IF EXISTS idx_system_audit_logs_new_value;
DROP INDEX IF EXISTS idx_system_audit_logs_old_value;

-- system_mfa_backup_codes
DROP INDEX IF EXISTS idx_system_mfa_backup_codes_created_at;
DROP INDEX IF EXISTS idx_system_mfa_backup_codes_used;

-- system_push_subscriptions
DROP INDEX IF EXISTS idx_system_push_subscriptions_active;
DROP INDEX IF EXISTS idx_system_push_subscriptions_created_at;

-- ticket_replies
DROP INDEX IF EXISTS idx_ticket_replies_ticket_id;

-- trusted_devices
DROP INDEX IF EXISTS idx_trusted_devices_fingerprint;
DROP INDEX IF EXISTS idx_trusted_devices_last_used;
DROP INDEX IF EXISTS idx_trusted_devices_user_id;

-- wallet_transactions
DROP INDEX IF EXISTS wallet_tx_wallet_idx;

-- weekly_insights
DROP INDEX IF EXISTS idx_weekly_insights_organization_id;

-- wiza
DROP INDEX IF EXISTS wiza_messages_session_id_created_idx;
DROP INDEX IF EXISTS idx_wiza_public_messages_session_created;
DROP INDEX IF EXISTS wiza_pub_messages_session_idx;
DROP INDEX IF EXISTS idx_wiza_public_sessions_visitor_updated;
DROP INDEX IF EXISTS wiza_pub_sessions_visitor_idx;

