-- Adds the columns the CSAT prompt's dismissal state machine and per-moment
-- feedback attribution need, on top of the tables already created in
-- 20260620151021_create_satisfaction_feedback_and_prompt_state.sql.
--
-- satisfaction_prompt_state previously had no way to distinguish an explicit
-- "Not Now"/close-button dismissal (should cool down for 30 days, and count
-- toward an exponential lock after repeated dismissals) from a passive one
-- (tap-outside/Escape/navigate-away — a lighter 14-day cooldown, does not
-- count toward the lock).
--
-- satisfaction_feedback previously had no way to tell which of the four
-- trigger moments (3rd withdrawal, KYC completion, employer's first bulk
-- employee sync, float top-up success) produced a given rating, beyond the
-- withdrawal moment being inferable from advance_id IS NOT NULL.

ALTER TABLE public.satisfaction_prompt_state
  ADD COLUMN dismissal_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_dismiss_type text CHECK (last_dismiss_type IN ('hard', 'passive'));

ALTER TABLE public.satisfaction_feedback
  ADD COLUMN trigger_moment text CHECK (trigger_moment IN (
    'employee_third_withdrawal',
    'employee_kyc_verified_3d',
    'employer_first_bulk_sync',
    'employer_topup_completed'
  ));
