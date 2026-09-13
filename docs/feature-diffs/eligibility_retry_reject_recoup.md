Feature diffs: eligibility split-brain, retry button, reject-flow guard, recoupment watchdog

Summary of relevant commits and changed files.

1) Eligibility / split-brain
Commit: 5be853c75e02f7485fbeb8c82273f08c1b417828
Title: fix: separate account approval from KYC eligibility for money movement
Files changed: (see commit history)
Notes: decouples account approval semantics from KYC-run eligibility checks so "approval" and "eligibility" are not read from the same table. This prevents split-brain where onboarding vs live employer rows differ. Key files to review: lib/services/payout-service.ts, app/api/* eligibility routes, lib/constants/employer-schema.ts.

2) Retry button / retry functionality
Commit: 6620c6f8972b253ac3dff7e4ec532b15228f83a0
Title: Add retry functionality, rename payment-verifications to bank-verifications, fix employer wallet initialization, and improve organization linking
Files changed:
- app/admin/advances/AdvancesClient.tsx
- app/dashboards/employer-dashboard/advances/page.tsx
- app/admin/bank-verifications/*
Notes: Adds UI and API hooks for manual retry flows (retry approval, retry disbursement). Relevant server-side route: app/api/admin/advances/[id]/retry-disbursement.

3) Reject-flow guard
Commit: ba0568dc366b9560206c05b073f815198a84d6a4
Title: db(migration): reject advances for D-rated employees; auto-fill fee from employees.application_fee_percent
Files changed:
- supabase/migrations/20260725_advances_risk_check.sql
Notes: Migration adds risk-level guard that prevents advances for D-rated employees at the DB level. Verify migration SQL and any code paths that depend on the error message.

4) Recoupment watchdog / payday recoupment
Commits:
- f89073ba4c20f8f92d6afac6f77a3c9e19086bec (feat: automated payday-based debt recoupment with real DusuPay collection)
  Files: app/api/webhook/dusupay/route.ts, lib/services/payday-recoupment-service.ts, app/api/employer-dashboard/payday-recoupment/*, app/admin/payday-recoupments/*, components/employer/PaydayRecoupmentModal.tsx, lib/dusupay/*

- a4ab4bf39b0d9fa09ddf004cc1a01e1071bf3331 (feat: bank-primary payday recoupment model)
  Files: lib/services/payday-recoupment-service.ts, app/api/cron/payday-recoupment/route.ts, UI updates

- 303cb8eea38c1caa1bfcf28f607dc4774a5d83ba (fix: payday recoupment was login-triggered only and settled the wrong number)
  Files: app/api/cron/payday-recoupment/route.ts, lib/services/payday-recoupment-service.ts, supabase/migrations/*

Notes: These commits introduce the automated recoupment flow, webhook handling, and a cron job to run recoupment checks. Key server components: app/api/cron/payday-recoupment/route.ts and lib/services/payday-recoupment-service.ts; review idempotency and audit logging.

-------
Next steps performed:
- Created this summary file in docs/feature-diffs/eligibility_retry_reject_recoup.md to capture the diffs and files to review.

If you want a PR containing the actual code diffs (patches), I can add per-commit patch files (git format-patch output) to the same directory before opening the PR. Otherwise I'll open a PR with this summary file for review.
