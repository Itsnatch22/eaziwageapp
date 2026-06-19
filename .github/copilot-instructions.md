Purpose

This file gives Copilot sessions targeted, repo-specific guidance: how to build/lint/run, the high-level architecture, and repository conventions that matter across files. Keep this file updated when critical infra, env vars, or data-model decisions change.

1) Build / Test / Lint

- Install deps: npm install
- Dev server (hot reload): npm run dev
- Build for production: npm run build
- Start production server: npm run start
- Lint: npm run lint (runs ESLint via eslint.config.mjs)

Tests
- There is no test script in package.json. package-lock.json references @playwright/test but Playwright is not set up in package.json. If Playwright or other test runners are added, prefer adding a package.json script (e.g., "test": "playwright test") so Copilot can call it. To run a single Playwright test (if added): npx playwright test path/to/file.spec.ts -g "Test name"

2) High-level architecture (big picture)

- Next.js 16 (App Router) — frontend, server actions, and API routes live under /app and /app/api.
- Supabase (Postgres) — primary database, Row-Level Security (RLS) enforced. Many DB constraints and policies are authoritative for access control.
- Drizzle ORM & direct Supabase clients — business logic lives in lib/services (payouts, reservations), lib/dusupay (gateway client), and lib/*.ts helper modules.
- Three-tier virtual wallet model: Admin (platform liquidity) → Employer virtual wallet (per-employer balance/reservations) → DusuPay (payment gateway mirror). See lib/services/payout-service.ts and lib/dusupay for flow points.
- Realtime: Pusher for live notifications. Email: Resend + React Email templates.
- Validation: Zod for runtime input validation; env.ts validates required environment variables at startup.
- Rate-limiting: Upstash Redis protects sensitive endpoints.

3) Key conventions and repository-specific pitfalls

- employer_onboarding vs employers (live) identity split
  - Two parallel identity tables exist: employer_onboarding (legacy / staged) and employers (authoritative/live). Many routes and migrations explicitly remap fields. When tracing employer configuration values, check both tables and any onboarding→employer promotion code.
  - See recommendations.md for explicit column remapping examples (max_advance_percentage → advance_limit_percent, cooldown_period → cooldown_days).

- employee_onboarding / employee_ewa_settings upsert behavior
  - Some admin upsert flows expect an employee_onboarding_id (NOT NULL). Routes that upsert employee_ewa_settings must fetch onboarding record first or risk constraint failures. See recommendations.md P0 for the exact upsert pattern.

- Numeric booleans: is_active columns
  - Several tables (e.g., blackout_periods, legal_documents) use numeric 0/1 columns rather than boolean. Code sometimes uses 1/0 conversions; prefer migrating to boolean or be consistent in queries (.eq('is_active', 1) vs .eq('is_active', true)). See recommendations.md P3.

- Risk score scale mismatch
  - DB stores risk_score on a 0–5 scale, while some UI defaults/thresholds have used 0–100. When working on risk logic, verify whether thresholds are normalized. See recommendations.md P1.

- Environment validation
  - env.ts throws on missing/invalid env vars (server start will fail). Copilot suggestions that modify startup or deployment must account for env.ts stricter validation.

- Webhooks & idempotency
  - DusuPay callbacks are signed and must be verified. Payouts use merchant_reference for idempotency. When adding or changing webhook handlers, preserve signature verification and idempotency keys.

- Security boundary expectations
  - Many protections (auth/authorization) are enforced by DB-level RLS and Supabase service-role separation. Do not rely solely on application-layer checks for sensitive DB access—verify RLS policies when changing access logic.

- Zod everywhere
  - Most API routes and actions validate inputs with Zod schemas under lib/validations. Keep runtime and compile-time shapes consistent.

- Monorepo / package-lock mismatch
  - package-lock references dev/test packages (Playwright) that are not present in package.json. Check package.json before assuming test tooling is installed.

4) Scripts, CI, and secrets relevant to automation

- Two scheduled GitHub Actions exist: .github/workflows/sync-stats.yml and sync-health.yml. Both call internal API endpoints and require a CRON_SECRET injected into Actions secrets. Copilot should not expose or hardcode secrets; suggest using GitHub Secrets and environment variables.

5) Files & entrypoints to inspect for common tasks

- Payout/disbursement: lib/services/payout-service.ts, lib/dusupay/client.ts, app/api/v1/payouts/* (verify, webhook). These are the critical paths for financial flows.
- Onboarding and admin settings: app/api/admin/settings/* and app/admin/settings/* (UI and API). Check these when altering EWA config or risk thresholds.
- Env validation: env.ts — always check before running or deploying.
- DB & migrations: supabase/ (migrations and functions). When suggesting SQL fixes, fetch full function/table definitions first.

6) Existing docs & auditor guidance to reuse

- rules.md contains a detailed security/audit scope and must be consulted for security-sensitive PRs and audits.
- recommendations.md contains surgical fixes for P0–P3 issues (employee EWA upsert, risk scale, onboarding column mappings, is_active migration). Reuse code examples from there when proposing changes.

7) How Copilot should behave in this repo

- Prefer minimal, surgical code edits with explicit file references. Avoid broad rewrites across onboarding vs live employers without a migration plan.
- When proposing DB changes, include exact SQL migration statements and a verification query. Always recommend testing migrations in staging first.
- For feature work touching payments or disbursements, include a checklist: unit tests (if added), manual sandbox DusuPay verification, webhook replay tests, and idempotency verification.

8) Quick pointers for new contributors (actions Copilot can suggest)

- To diagnose admin upsert failures: trace app/api/admin/settings/employees/[id]/route.ts -> ensure onboarding lookup happens before upsert.
- To fix risk-threshold bugs: prefer changing UI defaults to match DB 0–5 scale unless a DB migration is planned.
- To harden webhooks: re-check HMAC verification and merchant_reference idempotency.

Sources referenced by these notes: README.md, rules.md, recommendations.md, env.ts, package.json, .github/workflows/*.

If you update any of the core patterns above (onboarding identity, is_active column types, env.ts validation), update this copilot-instructions.md immediately.
