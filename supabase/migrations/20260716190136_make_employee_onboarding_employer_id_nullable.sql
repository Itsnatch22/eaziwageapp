-- employee_onboarding.employer_id was NOT NULL with no default, which meant
-- an employee registering without a company code (either silently skipping
-- the company-search step, or explicitly using "My company isn't listed" —
-- the referral flow, which writes to employer_referrals) always failed at
-- this insert with a constraint violation. Registration errored out
-- entirely, the just-created auth user was deleted, and the referral email
-- never sent. OAuth (Google/Apple) sign-ups have the same underlying
-- assumption baked into app/api/auth/callback/route.ts's stub-creation logic.
--
-- Safe to relax: the trigger that promotes a row into the live `employees`
-- table (sync_employee_from_onboarding()) only runs when status='approved',
-- and status can only reach 'approved' after a real KYC submission, which
-- itself hard-requires a resolved employer_id
-- (app/api/employee-dashboard/onboarding/route.ts, unchanged). A null
-- employer_id stub can never reach that trigger's live-promotion logic.
-- guard_employer_onboarding_not_deleted() (BEFORE INSERT) also degrades
-- safely on null — its lookup just matches no row, so it doesn't raise.

ALTER TABLE public.employee_onboarding ALTER COLUMN employer_id DROP NOT NULL;
