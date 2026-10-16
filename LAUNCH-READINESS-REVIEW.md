# EaziWage — Security & Code Audit Prompt

**How to use:** Run in Copilot from the repo root with the Supabase MCP connected **read-only**. Save to `prompts/security-code-audit.md`. Run one Layer per session for depth (Layers 1 and 3 first), or all layers for a full pass. Re-run after every major release and before any change to payout logic.

---

## 1. Role

You are a senior application-security engineer and fintech code auditor. You are auditing **EaziWage**, an earned-wage-access (EWA) platform that moves real money for employees in Kenya, Uganda, Tanzania and Rwanda.

Assume an attacker who has: the public Supabase anon key (it ships in the frontend), a free employee account, a free employer account, and full read access to the public GitHub repo.

Your job is to find what will **lose money, leak personal data, or break trust before launch**. You are not here to produce a reassuring score. A short list of true findings beats a long list of generic ones.

## 2. Why this audit exists

A prior review (15 Oct 2026) scored the platform 3/10, but it covered about 6 flows out of **211 API routes and 66 pages**, and explicitly excluded the live database, RLS and the DusuPay integration. A follow-up pass then found the most serious issue in the system: money-moving `SECURITY DEFINER` functions executable by `anon`. Treat the prior review as a seed list, never as proof of coverage.

**Stack:** Next.js (App Router, `proxy.ts` middleware) · Supabase (Postgres 17, project `EaziWage`, region eu-north-1, 111 public tables) · DusuPay (payouts, collections, webhooks) · TypeScript · Vitest + Playwright · Sentry · Vercel cron.

## 3. Rules of engagement (non-negotiable)

- **Production database is read-only.** `SELECT`, catalog queries, `get_advisors`, and logs only. No `INSERT/UPDATE/DELETE`, no DDL, no migrations, no RPC that writes.
- **Never call money-moving functions** to prove exploitability: `fund_employer_from_admin`, `reserve_employer_funds`, `release_employer_reservation`, `record_employee_disbursement_from_treasury`, `repay_advance_to_admin`, `repay_employer_liability_to_admin`, `transfer_admin_treasury_funds`, `credit_employer_wallet_prefunded`. Prove from grants + function bodies + code, or in a disposable staging project.
- **Never print secrets, keys, tokens, PII or decrypted values.** Redact to the first 4 characters.
- DusuPay: sandbox only.
- If you cannot verify something, say so. Do not fill gaps with plausible guesses.
- Do not trust code comments as evidence. Claims like "DusuPay support confirmed X" are **assumptions the system depends on**. List them.

## 4. Already known — verify, do not just copy

Re-verify each against the current code/DB. Mark: still present / fixed / partially fixed / cannot reproduce.

| ID | Known issue | Where |
|----|-------------|-------|
| K1 | Money RPCs are `SECURITY DEFINER`, executable by `anon`/PUBLIC, with **no caller check** in the body (`fund_employer_from_admin` accepts arbitrary `p_amount_local`). Exploitation not demonstrated; read from grants + bodies. | DB |
| K2 | Advance set to `completed` after `sendFunds` returns without confirming `COMPLETED`; treasury debited first. | `lib/services/payout-service.ts` ~839-901 |
| K3 | Webhook payout handler ignores `transaction_status`; idempotency row written as `COMPLETED` **before** the handler succeeds, so a retry after a handler failure is skipped. | `app/api/webhook/dusupay/route.ts` |
| K4 | Four code paths write `advances.status='completed'` with different side effects (disburseAdvance, webhook, reconciler `disbursed_pending_ledger`, watchdog). Two of them create no repayment schedule. | payout-service, webhook, `app/api/cron/reconcile-dusupay/route.ts` |
| K5 | `DusupayClient.request()` throws only on non-2xx, so a 200 carrying PENDING/FAILED looks like success. | `lib/dusupay/client.ts` |
| K6 | Merchant reference is deterministic per advance, so a manual retry after a real provider failure reuses a burned reference. | `lib/dusupay/utils.ts` |
| K7 | PII encryption key is passed as an RPC argument (`p_key`); it can surface in Postgres logs on error. | `submit_bank_change_request`, `upsert_employee_onboarding_pii`, others |
| K8 | `submit_bank_change_request` duplicate-pending check is check-then-insert; verify a partial unique index exists. | DB |
| K9 | 41/69 `SECURITY DEFINER` functions in `public` are anon-executable (23 non-trigger ones with no obvious caller check); 13/16 views lack `security_invoker`; 44 policies use `true`; 2 tables have RLS on and no policies. | DB |
| K10 | `npm audit --omit=dev`: 1 critical, 11 high, 7 moderate. Reachability not assessed. | `package-lock.json` |
| K11 | Only 2 migrations in the repo for 111 tables: schema is not reproducible from source. | `supabase/migrations` |
| K12 | Webhook IP allowlist fails **open** when `DUSUPAY_ALLOWED_IPS` is unset; trusts first `x-forwarded-for` hop; signature check accepts a header with no timestamp (replayable). | webhook route, `lib/dusupay/client.ts` |
| K13 | Public repo contains `ranked-fixes.md`, `docs/code-review-findings.md`, `logs.md`, `tsc_output.txt`, `prompts/`: a public map of the system's weaknesses. | repo root |
| K14 | `auto_approved: true` is written on every advance that passes the fraud check, including manually approved ones (audit-trail integrity). | payout-service ~683 |
| K15 | Items 1-10 of `LAUNCH-READINESS-REVIEW.md` (email confirmation bypass, onboarding retry lock, contact form false success, bank-change approval, etc.). | various |

## 5. Method: audit in layers

For every layer produce findings **and** a coverage statement (what you reviewed, how, and what you skipped).

### Layer 0: Inventory and coverage ledger (do this first)

Enumerate, with counts: every `app/api/**/route.ts` (expect 211), page, server action (`actions/`), cron, webhook, `lib/services/*`, Supabase table, view, function, trigger, policy, storage bucket, edge function.

For **each API route** record: methods, auth mechanism (session / `admin-auth` / `cron-auth` / signature / API key / **none**), required role, tables touched, RPCs called, user-supplied identifiers. Any route with no auth needs a written justification. Output as a ledger; every row ends as `reviewed`, `skimmed` or `not reviewed`.

### Layer 1: Database (highest priority; the first review skipped it)

Run these seed queries, then read the flagged bodies and policies, not just the counts.

```sql
-- Q1: SECURITY DEFINER functions callable by anon, with a crude caller-check heuristic
select p.oid::regprocedure as fn,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
       p.proconfig as config,
       pg_get_functiondef(p.oid) ~* 'auth\.uid\(\)|auth\.role\(\)|auth\.jwt\(\)|is_admin|current_setting\(' as has_caller_check
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
order by anon_exec desc, has_caller_check, 1;

-- Q2: permissive / suspicious policies (triage: UPDATE with null with_check falls back to USING)
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or with_check = 'true' or (cmd in ('UPDATE','ALL') and with_check is null))
order by tablename, cmd;

-- Q3: views that run as their owner (can bypass RLS on underlying tables)
select c.relname, c.reloptions,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authed_select
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
  and not coalesce(c.reloptions @> array['security_invoker=true'], false);

-- Q4: table coverage: RLS state, policy count, anon grants
select c.relname, c.relrowsecurity as rls,
       (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies,
       has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as anon_any
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p')
order by policies, c.relname;
```

Then also run Supabase `get_advisors` (security and performance) and reconcile with your findings.

Check, for every sensitive table:
- **Tenant isolation:** can employee A read or write employee B's rows? Can employer A touch employer B's? Reason from policy predicates, not table names.
- **UPDATE policies:** can a user change `role`, `employer_id`, `status`, `kyc_status`, `risk_score`, wallet fields on their own row? Check triggers such as `prevent_self_role_escalation` and `fn_protect_employer_financial_fields` actually close this.
- **Views:** for each of the 13 non-invoker views, what do they expose and to whom?
- **`SECURITY DEFINER` functions:** caller check, `search_path` pinned, dynamic SQL, grants (`anon`, `authenticated`, PUBLIC vs `service_role`). Decide per function: revoke from anon/authenticated, or add a caller check.
- **Storage:** policies per bucket (`avatars` is public; `employer-documents`, `employee-kyc-documents`, `payroll-uploads` are private): path scoping by owner, signed-URL TTL, content-type/size limits.
- **Encryption:** where the pgcrypto key lives (env arg vs Vault), rotation, whether decrypt RPCs (`admin_get_*`) check the caller and log every decryption.
- **Integrity:** unique/partial indexes behind app-level duplicate checks, CHECK constraints on status and money columns, FK `ON DELETE` behaviour, trigger side effects, realtime publications, installed extensions.
- **Reproducibility:** schema drift between the live DB and `supabase/migrations`; backups/PITR enabled and a restore drill performed.

### Layer 2: AuthN, AuthZ and sessions

- `proxy.ts`: matcher gaps, routes it doesn't cover, path-normalisation bypasses. Check the Next.js version against known middleware-bypass CVEs.
- **The critical pattern in this codebase:** the server uses a **service-role client that bypasses RLS**. For every route that accepts a user-supplied ID (`[id]`, query, body), confirm the handler itself verifies ownership/tenant. If it doesn't, RLS will not save you.
- Role determination: never from `user_metadata` or client-supplied fields. Trace how role and `employer_id` are resolved on every request.
- Auth flows: email-confirmation bypass (K15), account enumeration, brute-force/rate limits, OTP abuse and SMS pumping (`sendOtp`), MFA backup codes and device trust, password reset token entropy/expiry/reuse, session revocation on password or role change.
- Admin: `lib/server/admin-auth.ts`, founder-only checks, impersonation, audit logging of admin actions.
- Cron/internal/API-key routes (`/api/cron`, `/api/internal`, `/api/v1`, `/api/integrations`, `/api/beta`, `/api/console`): constant-time secret comparison, fail-closed when the secret is unset, key scopes.
- CSRF on cookie-authenticated mutations, CORS, open redirects.

### Layer 3: Money movement and ledger integrity

- **Draw the advance state machine** (`pending, approved, processing, processing_unknown, disbursed_pending_ledger, completed, failed, rejected, fraud_review, repaid` and any others in the DB). List every writer of `advances.status`: file, from→to, guard, side effects. Flag every transition that is unguarded (no `.eq('status', expected)`), unchecked (error ignored) or non-atomic.
- Double-pay, double-credit and double-repay under: concurrent requests, webhook retries and replays, cron overlap, admin retry, partial failure between steps.
- **Invariants.** Write the SQL that checks each, and run it read-only:
  - treasury debits = completed disbursements
  - `reserved_amount` = sum of open reservations
  - no completed advance without a schedule and a ledger row
  - no negative balances
  - `total_advanced − total_repaid − reserved ≥ 0` per employer
- Rounding and currency: floats vs `numeric`, zero-decimal currencies (UGX, RWF), USD conversion drift, fee/net calculation, limits and cooldown bypass, **client-supplied amount/fee/net tampering**.
- DusuPay webhooks: signature (timing-safe, timestamp window, un-timestamped fallback), IP allowlist fail-open, status normalisation, idempotency ordering, 5xx on handler failure, and whether the handler verifies **amount, currency and reference ownership against the DB record** rather than trusting the payload.
- Reconciliation: coverage of every non-terminal status, auto-heal vs alert-only, the 7-day lookback cut-off (older stuck advances never reconciled), alert fatigue.
- **Payout destination integrity:** can an account-takeover attacker redirect a payout via bank-change or payment-method-change? Look for a cooling-off period, re-authentication, notification to the old destination, and admin/dual control.
- Treasury operations: admin funding, internal transfers, approval controls, audit trail.
- Kill switch: who can set `disbursements_frozen`, and is it tested?

### Layer 4: PII, KYC and privacy

- Inventory PII (national ID, DOB, tax ID, bank/mobile-money numbers, KYC documents). For each: where stored, encrypted or not, who can decrypt, retention, deletion, backups. Check authorisation on `delete_employee_account_data` and `purge_employer_account_data`.
- Leak paths: `requestLogger`/`console.error` with payloads, Sentry `beforeSend` scrubbing, notification `metadata`, error messages, `raw_payload` columns, `/api/log-error`.
- Uploads: type, size and magic-byte validation; is ClamAV enforced or optional (`docs/CLAMAV-integration.md`); path traversal; SVG/HTML upload XSS; payroll CSV formula injection and parser limits.
- **Flag for counsel; do not give legal conclusions:** Kenya Data Protection Act 2019 (registration, DPIA, breach notification, data-subject rights), the equivalent regimes in Uganda/Tanzania/Rwanda, cross-border transfer implications of hosting in eu-north-1, EWA/credit licensing questions, and whether the "5-year CBK retention" audit logs are actually immutable.

### Layer 5: Web app, dependencies and infrastructure

- `npm audit --omit=dev`: triage each critical/high for **reachability in production code paths**. Check lockfile integrity and `postinstall` scripts.
- Headers: CSP is set dynamically in `proxy.ts`. Verify nonce use, no `unsafe-inline`/`unsafe-eval`, `frame-ancestors`, plus HSTS, Referrer-Policy, Permissions-Policy.
- XSS: the 2 `dangerouslySetInnerHTML` sites, markdown rendering, HTML in email templates built from user-controlled names, notification content.
- SSRF: `geocode`, `integrations`, any fetch of user-supplied URLs, outbound webhooks (payroll webhook secrets).
- Rate limiting on contact, OTP, register, login, support, messages, push, insights.
- Secrets: `env.ts` validation, `NEXT_PUBLIC_*` exposure, **git history scan** (gitleaks/trufflehog, including deleted files), secrets in `scripts/`. If any secret is found, treat it as burned and rotate.
- Deployment: prod vs preview env separation (preview deployments with prod keys?), branch protection, CI security checks, cron authentication, incident response.

### Layer 6: Code quality and reliability (only where it threatens correctness or security)

- Supabase calls whose `{ error }` is never checked; fire-and-forget `void supabaseAdmin...` on audit logs (compliance records silently dropped); empty `catch {}`; `as any` at trust boundaries; `.single()` vs `.maybeSingle()` crashes; read-modify-write races; `Number()` on money strings; routes without schema validation; unbounded queries.
- Date logic: `calculateDueDate`, month-end clamping, UTC vs local payday.
- **Tests:** 24 test files. Do they assert database and ledger outcomes, or only HTTP 200? List the missing money-path cases (duplicate callback, pending→completed, completed→failed, concurrent retry, ledger RPC failure).
- `tsc_output.txt` (75 KB) implies type errors: categorise them. Flag duplicated logic (three copies of the DusuPay status mapper) and TODO/FIXME/HACK near money code.

### Layer 7: Resilience and operations

- What happens when DusuPay is down, Supabase fails mid-transaction, a cron doesn't run, a webhook never arrives, or a deploy lands mid-flow? Runbook gaps (`docs/ROLLBACK.md`). Alerting on stuck states. Backup restore drill.

## 6. Evidence standard

Tag every finding:
- **[VERIFIED]** you saw it. Cite `file:line` or the query and its result.
- **[INFERRED]** reasoned from code/DB. State the assumption it rests on.
- **[NOT CHECKED]** out of reach. State what access you'd need.

No finding without a location. No generic OWASP item without a concrete instance in this repo. Separate **exploitable now** from **latent**.

## 7. Finding template

```
ID · Title · Severity · Layer · Evidence tag
Location:        file:line / table / function / query
What's wrong:    ...
Scenario:        who does what, and the impact (KES amount, records exposed, state corrupted)
Preconditions:   what the attacker/failure needs
Fix:             concrete SQL or code, smallest change that removes the risk
Verify the fix:  test or read-only query that proves it
Effort:          S / M / L
```

**Severity rubric**
- **Critical:** a low-privilege or unauthenticated actor can create/move money, cross tenant boundaries, or extract PII at scale; or money state can silently diverge from provider truth.
- **High:** exploitable with a realistic precondition (a compromised account, a race, a replay), or data loss/corruption with no recovery path.
- **Medium:** needs unusual conditions, or weakens a control without defeating it.
- **Low / Info:** hygiene, defence in depth, UX.

## 8. Deliverables

1. **Coverage ledger:** every route, table, view, function and bucket: `reviewed` / `skimmed` / `not reviewed`, method used, finding IDs.
2. **Findings**, sorted by severity, then effort.
3. **Fix-first list:** the top 10 in dependency order, each with the smallest change that removes the risk (e.g. one `REVOKE` can close several findings).
4. **Launch gates:** explicit pass/fail criteria for (a) first real funds moved, (b) public employee signup, (c) public employer signup.
5. **Not verified:** what you couldn't check and the access you'd need (staging project, Vercel env config, Supabase Auth dashboard settings such as leaked-password protection, MFA, SMTP, JWT expiry, rate limits).
6. **Scorecard:** 0-10 per layer with one sentence of justification. Give an overall score **only after stating coverage**, and never score higher than the coverage supports.
7. **Human follow-up:** which areas still need a third-party penetration test before real money moves.

## 9. Anti-patterns (do not do these)

- Padding the report with generic best-practice lists.
- Inventing line numbers or quoting code you didn't read.
- Marking something fixed without re-verifying it.
- Counting a test as coverage when it asserts only an HTTP status.
- Recommending a rewrite when a 5-line migration or guard removes the risk.
- Reporting "no issues found" for a layer you only skimmed.
- Softening a Critical because the database is currently small. Pre-launch is when fixes are cheapest, not when risk is low.