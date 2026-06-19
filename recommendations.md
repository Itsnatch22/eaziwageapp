# EaziWage Admin Settings — Surgical Fixes Implementation Guide

**Prepared:** June 19, 2026  
**Scope:** Admin Settings page + API routes  
**Database:** Supabase project `etfytrhduspebpvybljq`  
**Verified against:** Live schema + actual data rows  

---

## Pre-Flight: What the Database Confirmed

Before touching a single line of code, this is the verified ground truth:

| Table | Rows | State |
|---|---|---|
| `employee_ewa_settings` | 2 | Both created by onboarding flow. Admin route has never successfully inserted. No corruption yet. |
| `global_settings` | 1 | Stale partial payload. Risk settings keys don't match what the UI reads/writes. |
| `employees` | 4+ | `employer_id` correctly points to live `employers` table. Join is clean. |
| `employer_onboarding` | Active | Has its own EWA config columns with different naming convention than `employers`. |
| `blackout_periods` | — | `is_active` is `numeric`, not `boolean`. |
| `legal_documents` | — | `is_active` is `numeric`, not `boolean`. |

**Risk window:** You have 2 employees with EWA settings. The admin route cannot currently update them without risk of inserting a broken duplicate. Fix P0 before any admin saves `employee_ewa_settings`.

---

## Fix Order — Non-Negotiable

```
P0 → P1 → P2 → P3
```

Do not reorder. P0 affects data integrity. P1 affects financial logic. P2 and P3 are consistency fixes.

---

## P0: `employee_ewa_settings` — Admin Upsert is Broken

### What's Wrong

The table has this constraint structure:
- `employee_onboarding_id` — `NOT NULL`, no default (set by onboarding flow)
- `employee_id` — nullable (set later, used by admin route)
- `employer_id` — points to `employer_onboarding`
- `employer_live_id` — points to `employers` (live table)

The admin PUT route in `app/api/admin/settings/employees/[id]/route.ts` does:

```ts
const upsertPayload = {
  employee_id:            id,
  employer_live_id:       employee.employer_id,
  ewa_enabled:            validated.ewa_enabled ?? true,
  max_advance_percentage: validated.advance_limit_percent ?? 50,
  min_advance_amount:     500,
  max_advance_amount:     50000,
  cooldown_period:        validated.cooldown_days ?? 7,
  updated_by:             user.id,
  updated_at:             new Date().toISOString(),
};

const { data, error } = await adminSupabase
  .from('employee_ewa_settings')
  .upsert(upsertPayload, { onConflict: 'employee_id' })
```

**The bug:** When the upsert results in an INSERT (employee has no existing EWA settings row), `employee_onboarding_id` is never provided. This violates the `NOT NULL` constraint. The insert fails silently or throws, and the admin save appears to succeed on the frontend (the route catches the error but the toast fires from the `response.ok` check on the `PUT` response — which still returns 500).

### The Fix

**File:** `app/api/admin/settings/employees/[id]/route.ts`

**Step 1:** Before the upsert, fetch the employee's onboarding record to get `employee_onboarding_id` and `employer_id` (onboarding FK).

Replace the section that builds `upsertPayload` with:

```ts
// Fetch the employee's linked onboarding record
// employees.employer_id → employers (live). We need employer_onboarding separately.
const { data: onboardingRecord, error: onboardingError } = await adminSupabase
  .from('employee_onboarding')
  .select('id, employer_id')
  .eq('user_id', employee.user_id)  // employee_onboarding links via user_id
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

// If no onboarding record exists, we cannot safely insert a new ewa_settings row.
// We can only update an existing one via employee_id conflict.
// Log this case — it means the employee bypassed the onboarding flow.
if (!onboardingRecord && !current) {
  console.error(`[PUT employee EWA settings] No onboarding record found for employee ${id}. Cannot insert.`);
  return NextResponse.json(
    { error: 'Employee onboarding record not found. Cannot create EWA settings.' },
    { status: 422 }
  );
}

const upsertPayload = {
  employee_id:            id,
  // Only include employee_onboarding_id if we have it — on UPDATE (conflict) Postgres won't touch it
  ...(onboardingRecord && { employee_onboarding_id: onboardingRecord.id }),
  // employer_id points to employer_onboarding; employer_live_id points to employers
  ...(onboardingRecord && { employer_id: onboardingRecord.employer_id }),
  employer_live_id:       employee.employer_id,  // this is the live employers FK
  ewa_enabled:            validated.ewa_enabled ?? true,
  max_advance_percentage: validated.advance_limit_percent ?? 50,
  min_advance_amount:     500,
  max_advance_amount:     50000,
  cooldown_period:        validated.cooldown_days ?? 7,
  updated_by:             user.id,
  updated_at:             new Date().toISOString(),
};
```

**Step 2:** Also confirm the `employee` fetch includes `user_id` — it currently only selects `id, employer_id`. Update that query:

```ts
const { data: employee, error: empError } = await adminSupabase
  .from('employees')
  .select('id, employer_id, user_id')  // add user_id
  .eq('id', id)
  .single();
```

**Step 3:** Verify the link. Run this query once after deploying to confirm all existing `employee_ewa_settings` rows have a valid `employee_onboarding_id`:

```sql
SELECT 
  ews.id,
  ews.employee_id,
  ews.employee_onboarding_id,
  eo.id AS onboarding_exists
FROM employee_ewa_settings ews
LEFT JOIN employee_onboarding eo ON eo.id = ews.employee_onboarding_id
WHERE eo.id IS NULL;
-- Should return 0 rows. If not, those rows are orphaned.
```

**No schema migration required.** The columns exist. This is a route-only fix.

---

## P1: Risk Score Scale Mismatch

### What's Wrong

Two separate scales are in play and they will never agree:

| Location | Scale | Example |
|---|---|---|
| `employees.risk_score` | 0–5 (default: 3.0) | `3.0` = medium |
| `employer_onboarding.risk_score` | 0–5 (default: 3.0) | Same |
| `employers.risk_score` | 0–5 (default: 3.0) | Same |
| Risk & Compliance UI — thresholds | 0–100 | `80` = low, `60` = medium |
| `global_settings.risk_settings` (current) | Mixed / stale | `default_max_advance_percent: 50` — not a threshold |

The Risk tab saves thresholds like `employer_low_threshold: 80` into `global_settings.risk_settings`. Any advance approval pipeline that reads those thresholds and compares them to `employees.risk_score` (which is `3.0`) will classify every employee as high risk (`3.0 < 60`).

Additionally, the current `global_settings.risk_settings` payload has stale keys (`default_min_advance`, `default_max_advance_percent`) from a previous schema — none of the UI fields map to these.

### The Fix

**Decision required before coding:** Pick one scale and commit. The recommendation:

> **Keep the DB at 0–5. Adjust the UI thresholds to match.**

Reason: Changing the DB scale requires migrating every existing risk score across three tables and every downstream query that uses them. Changing the UI default values costs three lines.

**File:** `app/admin/settings/page.tsx`

Find the `RiskComplianceTab` component. Change the default threshold values to use a 0–5 scale:

```tsx
// BEFORE
value={settings.employer_low_threshold || 80}   // ← 0-100 scale
value={settings.employer_medium_threshold || 60}
value={settings.employee_low_threshold || 80}
value={settings.employee_medium_threshold || 60}
value={settings.auto_suspend_threshold || 40}
value={settings.reduce_limits_threshold || 60}

// AFTER — 0-5 scale matching the DB
value={settings.employer_low_threshold || 4.0}   // ≥4.0 = low risk
value={settings.employer_medium_threshold || 2.5} // 2.5–3.9 = medium
value={settings.employee_low_threshold || 4.0}
value={settings.employee_medium_threshold || 2.5}
value={settings.auto_suspend_threshold || 1.5}
value={settings.reduce_limits_threshold || 2.5}
```

Also update the `Input` min/max attributes and the `RangeSlider` bounds on those fields to reflect 0.0–5.0, with `step={0.1}`.

**File:** `app/api/admin/settings/risk/route.ts` — No changes needed to the route itself. It correctly stores whatever the UI sends into `global_settings.risk_settings`.

**Clean the stale `global_settings` payload.** Run this once in Supabase:

```sql
UPDATE global_settings
SET risk_settings = '{}'::jsonb,
    updated_at = now()
WHERE id = 'default';
```

This forces the UI to repopulate `risk_settings` with the correctly-keyed values on next save. The old stale keys (`default_min_advance`, `default_max_advance_percent`) will be gone.

**Downstream enforcement check:** After this fix, locate wherever your advance approval pipeline reads risk thresholds and confirm it reads from `global_settings.risk_settings` with the correct key names (`employer_low_threshold`, `employee_low_threshold`, etc.) and compares them to the 0–5 DB values. This is outside the admin settings routes but is the point where the mismatch causes actual financial impact.

---

## P2: `employer_onboarding` → `employers` EWA Column Name Mismatch

### What's Wrong

When an employer completes onboarding and gets promoted to the live `employers` table, EWA configuration column names differ:

| `employer_onboarding` | `employers` |
|---|---|
| `max_advance_percentage` | `advance_limit_percent` |
| `cooldown_period` | `cooldown_days` |
| `min_advance_amount` | `min_advance_amount` ✓ same |

If your onboarding approval route does a naive column copy, the EWA config from onboarding silently drops into the wrong fields or gets ignored entirely, and the employer defaults kick in.

### The Fix

**Locate your onboarding approval route** (not in the provided files — likely something like `app/api/admin/employers/[id]/approve/route.ts` or similar). Find where it writes from `employer_onboarding` to `employers`.

The copy block must explicitly remap:

```ts
// When promoting employer_onboarding → employers
const { data: onboarding } = await adminSupabase
  .from('employer_onboarding')
  .select('max_advance_percentage, cooldown_period, min_advance_amount')
  .eq('id', onboardingId)
  .single();

// Explicit remap — do NOT spread onboarding directly into employers
await adminSupabase
  .from('employers')
  .update({
    advance_limit_percent: onboarding.max_advance_percentage ?? 50,
    cooldown_days:         onboarding.cooldown_period ?? 7,
    min_advance_amount:    onboarding.min_advance_amount ?? 500,
  })
  .eq('id', employerId);
```

**Verify existing live employers have correct values.** Run:

```sql
SELECT 
  emp.id,
  emp.company_name,
  emp.advance_limit_percent,
  emp.cooldown_days,
  eo.max_advance_percentage as onboarding_advance_pct,
  eo.cooldown_period as onboarding_cooldown
FROM employers emp
LEFT JOIN employer_onboarding eo ON eo.id = emp.onboarding_id
WHERE emp.status = 'approved';
```

If `advance_limit_percent` is the default `50` but `onboarding_advance_pct` has a different value, the onboarding config was dropped. Those employers need a manual data patch.

---

## P3: `is_active` Numeric vs Boolean

### What's Wrong

Both `blackout_periods.is_active` and `legal_documents.is_active` are `numeric` in the DB. The frontend interface types them as `boolean`. The routes store `1`/`0`. Everything works now by accident — `1` is truthy in JavaScript. It will break the moment:
- A type-strict Supabase client upgrade enforces type coercion
- A future developer writes `.eq('is_active', true)` instead of `.eq('is_active', 1)`
- You add a Postgres trigger that does `WHERE is_active = TRUE`

### The Fix

**Option A (Recommended):** Migrate both columns to `boolean` — cleaner, type-safe, future-proof.

```sql
-- Run as a migration — test on a branch first
ALTER TABLE blackout_periods 
  ALTER COLUMN is_active TYPE boolean 
  USING CASE WHEN is_active = 1 THEN true ELSE false END;

ALTER TABLE blackout_periods 
  ALTER COLUMN is_active SET DEFAULT true;

ALTER TABLE legal_documents 
  ALTER COLUMN is_active TYPE boolean 
  USING CASE WHEN is_active = 1 THEN true ELSE false END;

ALTER TABLE legal_documents 
  ALTER COLUMN is_active SET DEFAULT true;
```

**After migration, update the routes:**

`app/api/admin/settings/blackouts/route.ts` and `blackouts/[id]/route.ts` — remove the `is_active ? 1 : 0` conversion:

```ts
// BEFORE
{ ...validated, is_active: validated.is_active ? 1 : 0 }

// AFTER
{ ...validated, is_active: validated.is_active }
```

`app/api/admin/settings/legal-documents/[type]/route.ts` — update the `.eq` filters:

```ts
// BEFORE
.eq('is_active', 1)
.update({ is_active: 0 })
.insert([{ ...validated, is_active: 1 }])

// AFTER
.eq('is_active', true)
.update({ is_active: false })
.insert([{ ...validated, is_active: true }])
```

**Option B:** Keep `numeric`, enforce it everywhere, document it. Only acceptable if you have no bandwidth for the migration right now. Document it with a comment in the schema and every route that touches it.

---

## Verification Checklist — Run After Each Fix

### After P0
```sql
-- Confirm no ewa_settings rows have null employee_onboarding_id
SELECT COUNT(*) FROM employee_ewa_settings WHERE employee_onboarding_id IS NULL;
-- Expected: 0

-- Test admin save via UI, then verify:
SELECT employee_id, employee_onboarding_id, max_advance_percentage, updated_at
FROM employee_ewa_settings ORDER BY updated_at DESC LIMIT 5;
```

### After P1
```sql
-- Confirm stale keys are gone
SELECT risk_settings FROM global_settings WHERE id = 'default';
-- Expected: {} or correctly-keyed object after first UI save

-- Confirm no advance pipeline query compares risk_score > 10 (would indicate 0-100 assumption)
-- Search your codebase: grep -r "risk_score" --include="*.ts" | grep -E "[0-9]{2,}"
```

### After P2
```sql
-- Confirm EWA config survived onboarding promotion for all live employers
SELECT 
  company_name,
  advance_limit_percent,
  cooldown_days,
  min_advance_amount
FROM employers 
WHERE status = 'approved'
ORDER BY created_at DESC;
```

### After P3
```sql
-- Confirm column types changed
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('blackout_periods', 'legal_documents') 
AND column_name = 'is_active';
-- Expected: boolean for both
```

---

## What You Are NOT Changing

These were flagged earlier but are confirmed non-issues after DB inspection:

- **`employers.status` enum filter** — enum values confirmed as `pending`, `approved`, `suspended`. The route's `.eq('status', 'approved')` is correct.
- **`employees.employer_id` join** — confirmed pointing to live `employers` table. Clean.
- **`employer_live_id` on `employee_ewa_settings`** — confirmed the column exists and is correctly populated by the route.
- **`global_settings` row existence** — the row exists with `id = 'default'`. The upsert pattern is safe.

---

## Files Modified — Summary

| File | Change | Risk |
|---|---|---|
| `app/api/admin/settings/employees/[id]/route.ts` | Add `user_id` to employee fetch; lookup onboarding record; conditionally populate `employee_onboarding_id` and `employer_id` on upsert | Low — additive, doesn't change existing rows |
| `app/admin/settings/page.tsx` | Change risk threshold defaults from 0-100 scale to 0-5 scale; update slider min/max/step | Low — UI display only until saved |
| `app/api/admin/settings/blackouts/route.ts` | Remove `? 1 : 0` conversion after migration | Low — after migration only |
| `app/api/admin/settings/blackouts/[id]/route.ts` | Same | Low |
| `app/api/admin/settings/legal-documents/[type]/route.ts` | Change `.eq('is_active', 1)` to `.eq('is_active', true)` after migration | Low — after migration only |
| Your onboarding approval route (not provided) | Add explicit column remap on employer promotion | Medium — test in staging first |

---

## Final Note

P0 and P1 are the only bugs actively threatening production data right now. P0 because the admin cannot successfully save individual employee EWA settings, and P1 because any automated advance decision logic reading those risk thresholds from `global_settings` is operating on a broken comparison.

P2 and P3 are time bombs — they are not yet causing user-visible failures but will, and they get exponentially harder to fix as data volume grows.

Fix in order. Test each fix in isolation before moving to the next.

---

NEXT RECOMMENDED STEPS — Stanbic token integration (high priority)

1. Configure secrets in staging
   - Add STANBIC_TOKEN_URL and STANBIC_API_KEY (or STANBIC_SANDBOX_API_KEY) to staging environment/Secrets. Also ensure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are present for token caching.

2. Validate token exchange format
   - Confirm Stanbic's token endpoint auth method (Basic auth with client_id/secret, or Bearer API key, or client_credentials in body). If Basic is required, store CLIENT_ID/CLIENT_SECRET in env and update lib/stanbic/client.fetchStanbicToken() accordingly.

3. Smoke test in sandbox
   - Deploy branch to a staging preview with the new env values.
   - Call the admin wallet sync endpoint (POST /api/admin/wallet/sync) to trigger token fetch + balance call. Verify no secrets are logged and the balance sync completes.

4. Add integration test and CI secret setup
   - Add a lightweight Playwright or API test that hits the wallet sync route in staging preview; store secrets in GitHub Actions secrets and restrict to protected branches.

5. Production rollout plan
   - After successful staging validation, add prod STANBIC_TOKEN_URL and keys to production secrets, deploy, and monitor.
   - Add an alert for token fetch failures and Redis errors (e.g., Sentry / logs + a P1 alert threshold).

6. Optional hardening
   - Use a Redis namespace/key per environment and rotate token cache keys when rolling credentials.
   - If Stanbic issues short-lived tokens, consider refreshing proactively (background job) rather than on-demand during user-facing requests.

Add these steps to the deployment playbook and mark the P0/P1 fixes as prerequisites before making any data migrations that touch employer balances.
