# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server with hot reload (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint (flat config via eslint.config.mjs)
```

**Tests:** No test script exists in `package.json`. `package-lock.json` references `@playwright/test` but Playwright is not configured. If Playwright is added, run a single test with: `npx playwright test path/to/file.spec.ts -g "Test name"`

## Architecture

**EaziWage** is an Earned Wage Access (EWA) fintech platform for the East African market (Kenya, Uganda, Tanzania, Rwanda). It connects three roles: employees (request advances), employers (approve/manage), and admins (fund management, KYC, fraud).

### Core stack
- **Next.js 16** (App Router) — all pages, server actions, and API routes under `app/` and `app/api/`
- **Supabase (PostgreSQL)** — primary database; RLS is the authoritative security boundary, not application-layer checks
- **Drizzle ORM** + direct Supabase clients — business logic in `lib/services/` and `lib/dusupay/`
- **Pusher** — real-time notifications; **Resend + React Email** — transactional email
- **Upstash Redis** — rate limiting on sensitive endpoints
- **DusuPay** — payment gateway for mobile money + bank disbursements
- **Zod** — runtime input validation on all API routes and server actions (schemas in `lib/validations/`)
- **env.ts** — validates all required env vars at startup; the server will not start if any are missing or malformed

### Three-tier virtual wallet model

```
Admin Wallet (Main Stanbic)
    ↓ fund_employer_from_admin()
Employer Virtual Wallet (per-employer balance + reservations)
    ↓ reserveFunds() → disburseAdvance()
DusuPay Gateway / Mirror
```

Key files for financial flows: `lib/services/payout-service.ts`, `lib/dusupay/client.ts`, `app/api/v1/payouts/`.

### Key directories

| Path | Purpose |
|------|---------|
| `app/api/` | All API routes (admin/, auth/, advances/, employees/, employers/, v1/, webhook/) |
| `lib/services/` | Core business logic — payouts, earnings |
| `lib/dusupay/` | DusuPay API client, types, webhook handling |
| `lib/validations/` | Zod schemas |
| `lib/auth.ts` | Session and auth helpers |
| `lib/fraud-engine.ts` | Rule-based fraud detection |
| `lib/supabaseAdmin.ts` | Service-role client (bypasses RLS — trusted contexts only) |
| `lib/supabaseServer.ts` | Server-side user-scoped client |
| `components/ui/` | shadcn/ui base components |
| `supabase/` | 59 SQL migration files + Edge Functions |
| `emails/` | React Email templates |
| `hooks/` | Custom React hooks (useNotifications, usePushNotifications, etc.) |

## Known pitfalls and conventions

### Identity split: `employer_onboarding` vs `employers`
Two parallel tables exist. `employer_onboarding` is the legacy de facto source of truth; `employers` is the intended authoritative table but is sparsely populated. A three-phase migration is in progress. When tracing employer config values, check both tables and any onboarding→employer promotion code. Column names differ: `max_advance_percentage` (onboarding) → `advance_limit_percent` (employers), `cooldown_period` → `cooldown_days`. **Do not do broad rewrites across these tables without a migration plan.**

### Employee EWA upserts require a fetch-first pattern
`employee_ewa_settings` upserts expect `employee_onboarding_id` (NOT NULL constraint). Routes that upsert this table must fetch the onboarding record first or they will fail on constraint violations. See `app/api/admin/settings/employees/[id]/route.ts`.

### Numeric booleans (`is_active`)
Some tables (e.g., `blackout_periods`, `legal_documents`) store boolean state as `0`/`1` integers, not `true`/`false`. Be consistent when querying: `.eq('is_active', 1)` not `.eq('is_active', true)` for these columns.

### Risk score scale mismatch
The DB stores `risk_score` on a **0–5** scale. Some UI defaults/thresholds were written assuming **0–100**. When working on risk logic, verify which scale a given threshold uses before changing it.

### Webhooks: signature verification + idempotency
DusuPay callbacks are HMAC-SHA256 signed. Never add or modify webhook handlers without preserving signature verification. Payouts use `merchant_reference` as an idempotency key — do not remove this.

### Security boundary
RLS policies at the DB level are the primary access control mechanism. Do not rely solely on application-layer auth checks for sensitive DB access. The Supabase service-role key (in `lib/supabaseAdmin.ts`) bypasses RLS — only use it in trusted server contexts (API routes, server actions), never client-side.

### DB changes
When proposing schema changes, include the exact SQL migration file and a verification query. Always test migrations in staging before applying to production. 59 migration files already exist in `supabase/`; new migrations must be sequential.

## CI/CD

Two scheduled GitHub Actions exist (`.github/workflows/sync-stats.yml` and `sync-health.yml`). Both call internal API endpoints and require a `CRON_SECRET` in GitHub Actions Secrets.

## Environment variables

`env.ts` is the canonical source for all required variables. Changes to deployment config must account for its validation or the server will fail to start. Key groups:
- **Supabase** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **DusuPay** — `DUSUPAY_PUBLIC_KEY`, `DUSUPAY_SECRET_KEY`, `DUSUPAY_WEBHOOK_SECRET`, `DUSUPAY_ENVIRONMENT`
- **Pusher** — `NEXT_PUBLIC_PUSHER_APP_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`, `PUSHER_APP_ID`, `PUSHER_APP_SECRET`
- **Email** — `RESEND_API_KEY`
- **Rate limiting** — `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **Push notifications** — `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- **Stanbic** — `STANBIC_*` (bank integration)

## Reference docs

- `rules.md` — security audit scope; consult for security-sensitive changes
- `recommendations.md` — surgical fixes for known P0–P3 issues (upsert patterns, risk scale, column mappings); reuse code examples from there when addressing those issues
