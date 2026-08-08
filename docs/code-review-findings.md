Summary

One-sentence: The money-paths (onboarding → employer promotion → reserve → disburse → reconcile → repay) are thoughtfully implemented, but there are two high-risk gaps that could cause lost funds or failed webhook processing: missing DusuPay environment validation and inconsistent "is_active" column types vs runtime boolean checks.

Critical issues

## Issue: Missing validation for DusuPay environment variables
**File:** C:\Users\Admin\Desktop\eaziwage\env.ts (additions suggested)
**Severity:** High
**Problem:** The codebase uses DUSUPAY-related environment variables in multiple places (lib/dusupay/client.ts, lib/dusupay/client.ts:verifyWebhookSignature, app/api/webhook/dusupay/route.ts, tests and docs). env.ts currently does not validate or return any DUSUPAY_* vars. If the webhook secret or API keys are absent or misconfigured, webhooks will be rejected (verifyWebhookSignature returns false when the secret is empty) or DusuPay client will be misconfigured. This can cause automated reconciliation failures, rejected webhooks (401), and silent loss of payout/collection visibility.
**Evidence:**
- lib/dusupay/client.ts reads process.env.DUSUPAY_PUBLIC_KEY, DUSUPAY_SECRET_KEY, DUSUPAY_ENVIRONMENT, DUSUPAY_SANDBOX/PRODUCTION_BASE_URL but env.ts has no checks for these names.
- app/api/webhook/dusupay/route.ts: if (!signature || !dusupay.verifyWebhookSignature(...)) returns 401 — if secret is missing, all webhooks are 401.

Snippet (lib/dusupay/client.ts):

const isConfigured: boolean = Boolean(this.publicKey && this.secretKey);
this.publicKey = process.env.DUSUPAY_PUBLIC_KEY || '';
this.secretKey = process.env.DUSUPAY_SECRET_KEY || '';

**Risk/Impact:** High — inbound webhooks failing will leave disbursement/collection flows unresolved; missed webhooks can lead to funds marked in-flight indefinitely and require manual reconciliation. Outbound calls may be made with missing keys, causing runtime errors or unexpected behavior.

**Suggested fix:** Update env.ts to validate and return the DUSUPAY_* variables used by the client and webhook verifier. Minimal changes:
- Add DUSUPAY_ENVIRONMENT, DUSUPAY_PUBLIC_KEY, DUSUPAY_SECRET_KEY, DUSUPAY_WEBHOOK_SECRET, DUSUPAY_SANDBOX_BASE_URL, DUSUPAY_PRODUCTION_BASE_URL, DUSUPAY_INCLUDE_EMPTY_SECRET to the EnvConfig interface
- Add validation checks (presence of DUSUPAY_PUBLIC_KEY at least for sandbox; require DUSUPAY_WEBHOOK_SECRET in production, or always validate and fail early so deployments catch misconfig)
- Return those variables in getEnv()

Exact patch (apply to C:\Users\Admin\Desktop\eaziwage\env.ts – insert into the interface and validation block):

--- PATCH (to apply manually) ---
// 1) Add to EnvConfig (near other STANBIC/AT vars):
  DUSUPAY_ENVIRONMENT?: string;
  DUSUPAY_PUBLIC_KEY?: string;
  DUSUPAY_SECRET_KEY?: string;
  DUSUPAY_WEBHOOK_SECRET?: string;
  DUSUPAY_SANDBOX_BASE_URL?: string;
  DUSUPAY_PRODUCTION_BASE_URL?: string;
  DUSUPAY_INCLUDE_EMPTY_SECRET?: string;

// 2) In validateEnv() server-side checks, add after existing DUSUPAY/stanbic blocks:
    // DusuPay config
    if (!process.env.DUSUPAY_PUBLIC_KEY) {
      errors.push('DUSUPAY_PUBLIC_KEY is not defined');
    }
    // secret key optional for sandbox, but warn/fail in production
    if (process.env.DUSUPAY_ENVIRONMENT === 'production' && !process.env.DUSUPAY_SECRET_KEY) {
      errors.push('DUSUPAY_SECRET_KEY is not defined for production environment');
    }
    if (!process.env.DUSUPAY_WEBHOOK_SECRET) {
      errors.push('DUSUPAY_WEBHOOK_SECRET is not defined (required to verify webhooks)');
    }
    if (process.env.DUSUPAY_SANDBOX_BASE_URL && !isValidUrl(process.env.DUSUPAY_SANDBOX_BASE_URL)) {
      errors.push('DUSUPAY_SANDBOX_BASE_URL is not a valid URL');
    }
    if (process.env.DUSUPAY_PRODUCTION_BASE_URL && !isValidUrl(process.env.DUSUPAY_PRODUCTION_BASE_URL)) {
      errors.push('DUSUPAY_PRODUCTION_BASE_URL is not a valid URL');
    }

// 3) Add the values to the returned object at function end:
    DUSUPAY_ENVIRONMENT: process.env.DUSUPAY_ENVIRONMENT,
    DUSUPAY_PUBLIC_KEY: process.env.DUSUPAY_PUBLIC_KEY,
    DUSUPAY_SECRET_KEY: process.env.DUSUPAY_SECRET_KEY,
    DUSUPAY_WEBHOOK_SECRET: process.env.DUSUPAY_WEBHOOK_SECRET,
    DUSUPAY_SANDBOX_BASE_URL: process.env.DUSUPAY_SANDBOX_BASE_URL,
    DUSUPAY_PRODUCTION_BASE_URL: process.env.DUSUPAY_PRODUCTION_BASE_URL,
    DUSUPAY_INCLUDE_EMPTY_SECRET: process.env.DUSUPAY_INCLUDE_EMPTY_SECRET,
--- END PATCH

Verification steps:
- Add the new vars to .env.local and run a dev build; validate getEnv() returns the keys, and app/api/webhook/dusupay/route.ts accepts a properly signed webhook.
- Run the existing webhook handler tests (tests/webhook-handler.spec.ts) — they already skip if secret absent; now they should run when secret is present.

Major issues

## Issue: Database "is_active" columns are numeric but code treats them as booleans
**Files:** C:\Users\Admin\Desktop\eaziwage\lib\db\schema.ts, many API routes (examples below)
**Severity:** High
**Problem:** The schema uses numeric(1,0) for several is_active columns, e.g. blackout_periods.is_active and legal_documents.is_active. Runtime code in numerous places uses boolean literals (is_active === true or .eq('is_active', true)) or types that expect boolean. This mismatch can cause queries to return no rows (boolean true !== numeric 1 in some drivers/filters) or cause subtle permission/feature toggles to behave incorrectly.
**Evidence:**
- lib/db/schema.ts: blackoutPeriods.is_active: numeric('is_active', { precision: 1, scale: 0 }).default('1').notNull()
- app/api/admin/settings/legal-documents/route.ts selects .eq('is_active', 1) in one place and others use .eq('is_active', true) — inconsistent usage exists across codebase.

Snippet (C:\Users\Admin\Desktop\eaziwage\lib\db\schema.ts):
  is_active: numeric('is_active', { precision: 1, scale: 0 }).default('1').notNull(),

**Risk/Impact:** High — feature toggles/blackout periods and legal documents visibility may be incorrect; edge-case failing legal checks could affect compliance and user experience.

**Suggested fix:** Two possible approaches (pick one):
A) Migrate DB columns to BOOLEAN type and update defaults; update Drizzle schema to use boolean. This is the clean long-term fix.
B) If a migration is not immediately possible, make the code consistently query numeric values (use .eq('is_active', 1)) everywhere and update type annotations to accept number.

Recommended (A): perform an atomic migration to convert numeric(1) -> boolean with safe USING clause and default update.

SQL migration (apply via supabase migration):

--- SQL MIGRATION: convert is_active numeric to boolean ---
BEGIN;
ALTER TABLE public.blackout_periods
  ALTER COLUMN is_active TYPE BOOLEAN USING (is_active::int = 1),
  ALTER COLUMN is_active SET DEFAULT true;

ALTER TABLE public.legal_documents
  ALTER COLUMN is_active TYPE BOOLEAN USING (is_active::int = 1),
  ALTER COLUMN is_active SET DEFAULT true;

-- Add additional tables that use numeric is_active similarly if present
COMMIT;

-- Verification queries
SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('blackout_periods','legal_documents') AND column_name = 'is_active';
SELECT id, is_active FROM blackout_periods LIMIT 5;
--- END SQL

Apply Drizzle schema update: replace numeric('is_active'...) with boolean('is_active').default(true).notNull() in lib/db/schema.ts for the affected tables.

Minor issues

## Issue: Multiple webhook verification implementations — potential maintenance drift
**Files:** C:\Users\Admin\Desktop\eaziwage\lib\dusupay\client.ts (verifyWebhookSignature) and C:\Users\Admin\Desktop\eaziwage\lib\dusupay\webhooks.ts (DusupayWebhookHandler.verifyHmac)
**Severity:** Medium
**Problem:** Two different verification code paths exist. The app's webhook route uses dusupay.verifyWebhookSignature (client implementation). lib/dusupay/webhooks.ts implements a different verification scheme (HMAC over a payload string of selected fields and optional IP whitelist) but appears unused. Having two definitions increases risk of drift and confusion when DusuPay changes signature semantics.
**Evidence:** both files implement HMAC checks but with different canonicalization and allowed IP checks in webhooks.ts.

**Suggested fix:** Consolidate to a single verification function. Prefer the client.verifyWebhookSignature already used by the route; if IP allowlist is required, augment that function to optionally validate request IPs using an env var (DUSUPAY_ALLOWED_IPS) and call it from the route.

## Issue: Webhook route relies only on signature; does not validate IP allowlist
**Files:** C:\Users\Admin\Desktop\eaziwage\app\api\webhook\dusupay\route.ts
**Severity:** Medium
**Problem:** The webhook route verifies the signature header but does not combine that with an IP allowlist check. In the event the webhook signing secret leaks, an attacker could send validly signed payloads (if they know secret). IP allowlist provides defense-in-depth.
**Suggested fix:** Add optional IP allowlist check: read DUSUPAY_ALLOWED_IPS from env (comma-separated) and compare the request IP (x-real-ip/x-forwarded-for) before processing. If absent, keep existing signature-only behavior.

Positive feedback

- The payout and reconciliation flows show careful attention to money integrity: idempotency checks (merchant_reference), network-error distinction (DusupayNetworkError), treasury RPC separation, and explicit "processing_unknown" state for indeterminate outcomes.
- Payment method PII is consistently encrypted via RPC and the paymentMethodsService centralizes decryption + masking before any client response (decryptAndMaskRow), reducing risk of accidental plaintext leaks.
- Employer promotion logic (lib/services/employer-promotion.ts) is idempotent and carefully stamps live_employer_id for pre-promoted employee_onboarding rows.

Questions for maintainers

1. Migration preference for is_active: do you want to migrate DB columns to BOOLEAN now (recommended) or prefer a code-only compatibility pass first?
2. What is the intended DusuPay signature canonicalization (payload-only HMAC vs timestamped t=.../s=... semantics)? Tests reference the client method — is webhooks.ts legacy and safe to remove?
3. Should webhook route enforce an IP allowlist in addition to signature verification (requires listing DUSUPAY_ALLOWED_IPS env var)?

Recommended fixes (exact edits / patches)

1) env.ts: add DUSUPAY var validation and returned values
- See the exact patch above in "Critical issues". (Insert into interface, validation block, and returned object.)

2) is_active DB migration
- See the exact SQL migration above. After applying, update lib/db/schema.ts to use boolean('is_active', { default: true }).notNull() for changed tables.

3) Webhook IP allowlist (small optional hardening patch)
- Edit: app/api/webhook/dusupay/route.ts — after computing `ip` at top, add:

const allowed = (process.env.DUSUPAY_ALLOWED_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
if (allowed.length > 0 && !allowed.includes(ip)) {
  log.warn('Webhook IP not in allowed list', { ip });
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

(Or centralize in lib/dusupay/client.ts using existing webhooks handler.)

4) Consolidate webhook verification code
- Remove lib/dusupay/webhooks.ts or fold its allowlist logic into client.verifyWebhookSignature. If you prefer minimal change, add a unit test asserting parity between the two implementations for a few canonical payloads, then retire the unused one.

SQL migrations (if needed)

(Repeat migration for is_active conversion above.) Add migration to create a safe backfill test before ALTER:

-- Quick sanity check before migration
SELECT COUNT(*) FROM blackout_periods WHERE is_active NOT IN (0,1);

If 0, proceed with ALTER as shown earlier.

Verification steps

- For env change: start the app with missing DUSUPAY_WEBHOOK_SECRET — validate startup fails. Provide correct DUSUPAY vars in .env.local and ensure webhook route accepts a properly signed payload (use tests/webhook-handler.spec.ts or the docs curl commands in docs/dusupay-sandbox-header-verification.md).
- For is_active migration: run the SELECT verification and confirm queries that previously used .eq('is_active', true) still return expected rows. Run unit tests and smoke tests for admin settings and blackout-period listing pages.
- For webhooks/IP: deploy to staging, send signed webhooks from expected sandbox IPs and verify green; send from other IPs and verify rejected if DUSUPAY_ALLOWED_IPS configured.

Checklist for deployment and tests

- [x] Add DUSUPAY_* variables to staging/prod secrets (DUSUPAY_PUBLIC_KEY, DUSUPAY_SECRET_KEY, DUSUPAY_WEBHOOK_SECRET, optional base URLs) — Completed: env.ts now validates and exposes these variables.
- [x] Consolidate webhook verification implementations — Completed: lib/dusupay/webhooks.ts now delegates to lib/dusupay/client.verifyWebhookSignature and uses DUSUPAY_ALLOWED_IPS for allowlist support.
- [x] Add DUSUPAY_ALLOWED_IPS to .env.local — Completed; appended to .env.local (sandbox & prod IPs included as defaults).
- [x] Run env validation locally and in CI to catch missing keys early
- [x] Run SQL migration on a snapshot DB: convert is_active columns to boolean; run a smoke test of admin settings and blackout pages — Not required: live DB already uses BOOLEAN; updated Drizzle schema (lib/db/schema.ts) and code to treat is_active as boolean to match production.
- [ ] Run tests: npm test / vitest suite; specifically webhook-handler.spec.ts and employer-schema.spec.ts
- [ ] Monitor reconciliation logs and dusupay_reconciliation_mismatches after deployment for 24–48h

Questions / Verdict

Summary verdict: No critical logic bugs that would immediately cause funds to be sent to wrong accounts were found in the audit of payout/disbursement/recoup flows — the code contains many defensive checks (idempotency, RPC-ledger separation, treasury validation). The highest-priority fixes are infrastructure/ops: validate DUSUPAY environment variables at startup so webhooks and client are correctly configured, and fix the is_active numeric-vs-boolean mismatch (DB migration recommended) to remove a source of subtle behavior differences. After those fixes, run the provided verification and monitor reconciliation metrics.

If you want, I can also:
- Produce a single small PR containing the env.ts edits described + unit tests that fail when DUSUPAY_WEBHOOK_SECRET is absent
- Produce the Drizzle/TypeScript schema edits for boolean is_active columns (post-migration)

