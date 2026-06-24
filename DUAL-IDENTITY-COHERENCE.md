# EaziWage — Dual-Identity Coherence Audit
**Scope:** `employer_onboarding` ↔ `employers` · `employee_onboarding` ↔ `employees`  
**Date:** 2026-06-24  
**Status of `employer_wallets` FK:** ✅ Already points to `employers.id` — no action needed.

---

## Background: The Dual-Identity Pattern

EaziWage uses a two-table pattern for both sides of the marketplace:

| Onboarding table | Live table |
|---|---|
| `employer_onboarding` | `employers` |
| `employee_onboarding` | `employees` |

The intent is clean: *onboarding* captures the KYC/submission journey; the *live* table holds the approved operational record. The problem is that the boundary has never been consistently enforced — FKs, RLS policies, column layouts, and application code reference both tables interchangeably for the same logical entity, causing the "fighting" you feel.

---

## Issue 1 — Split FK allegiance on `employee_onboarding.employer_id`

### What's happening
`employee_onboarding.employer_id` has a **hard FK to `employer_onboarding.id`**, not to `employers.id`.

```
employee_onboarding.employer_id → employer_onboarding.id  ✅ (correct for onboarding stage)
```

BUT the sync trigger `sync_employee_from_onboarding` must then join back through `employer_onboarding → employers` via `user_id` to find the live employer ID — a fragile two-hop lookup that silently returns NULL and throws an EXCEPTION if the timing is off:

```sql
-- Inside sync_employee_from_onboarding
SELECT e.id INTO v_live_employer_id
FROM public.employer_onboarding eo
JOIN public.employers e ON e.user_id = eo.user_id   -- ← join on user_id, not onboarding_id
WHERE eo.id = NEW.employer_id
LIMIT 1;
```

### Why it fights
- If an employer is approved *after* an employee onboarding record is created, the trigger fires during the employee approval, and `employers` may not exist yet → EXCEPTION.
- `employers.onboarding_id` exists as a back-reference but the sync function ignores it, preferring `user_id` match — these can diverge.
- Downstream tables that need the live employer (advances, fraud_flags, policies) **must** use `employers.id`, so every query joining from `employee_onboarding` to those tables must traverse this same fragile join.

### Fix
Add a `live_employer_id uuid REFERENCES employers(id)` column to `employee_onboarding`, populated by the approval trigger. The sync function should read this directly rather than computing it at sync time.

```sql
-- Migration
ALTER TABLE employee_onboarding
  ADD COLUMN live_employer_id uuid REFERENCES employers(id);

-- Backfill
UPDATE employee_onboarding eo
SET live_employer_id = e.id
FROM employer_onboarding eob
JOIN employers e ON e.user_id = eob.user_id
WHERE eo.employer_id = eob.id
  AND e.id IS NOT NULL;

-- Updated sync function (replace body of sync_employee_from_onboarding)
CREATE OR REPLACE FUNCTION sync_employee_from_onboarding()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_email text;
  v_name  text;
  v_live_employer_id uuid;
  v_employment_type  text;
BEGIN
  IF NEW.status = 'approved' THEN
    -- Prefer the pre-resolved live_employer_id column
    v_live_employer_id := NEW.live_employer_id;

    -- Fallback: resolve via onboarding_id back-reference (belt-and-suspenders)
    IF v_live_employer_id IS NULL THEN
      SELECT e.id INTO v_live_employer_id
      FROM public.employers e
      WHERE e.onboarding_id = NEW.employer_id
      LIMIT 1;
    END IF;

    IF v_live_employer_id IS NULL THEN
      RAISE EXCEPTION
        'sync_employee_from_onboarding: no live employer found. employer_onboarding_id=%, employee_user_id=%',
        NEW.employer_id, NEW.user_id;
    END IF;

    SELECT COALESCE(NEW.email, NEW.email_placeholder, p.email),
           COALESCE(NEW.full_name, NEW.full_name_placeholder, p.full_name, 'Anonymous')
      INTO v_email, v_name
    FROM public.profiles p
    WHERE p.id = NEW.user_id;

    v_email := COALESCE(v_email, NEW.email, NEW.email_placeholder);
    v_name  := COALESCE(v_name, NEW.full_name, NEW.full_name_placeholder, 'Anonymous');

    IF v_email IS NULL THEN
      RAISE EXCEPTION
        'sync_employee_from_onboarding: email required. user_id=%, onboarding_id=%',
        NEW.user_id, NEW.id;
    END IF;

    v_employment_type := lower(replace(COALESCE(NEW.employment_type, 'full-time'), '_', '-'));

    INSERT INTO public.employees (
      user_id, employer_id, email, name, full_name, employee_code, employee_number,
      job_title, department, monthly_salary, employment_type, hire_date,
      kyc_status, status, country, updated_at
    ) VALUES (
      NEW.user_id, v_live_employer_id, v_email, v_name, v_name,
      NEW.employee_code, NEW.employee_code, NEW.job_title, NEW.department,
      NEW.monthly_salary, v_employment_type, NEW.start_date,
      'approved', 'Active', NEW.country, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      employer_id     = EXCLUDED.employer_id,
      email           = COALESCE(EXCLUDED.email, employees.email),
      name            = EXCLUDED.name,
      full_name       = EXCLUDED.full_name,
      employee_code   = EXCLUDED.employee_code,
      employee_number = EXCLUDED.employee_number,
      job_title       = EXCLUDED.job_title,
      department      = EXCLUDED.department,
      monthly_salary  = EXCLUDED.monthly_salary,
      employment_type = EXCLUDED.employment_type,
      hire_date       = EXCLUDED.hire_date,
      kyc_status      = EXCLUDED.kyc_status,
      status          = EXCLUDED.status,
      country         = COALESCE(EXCLUDED.country, employees.country),
      updated_at      = NOW();
  END IF;
  RETURN NEW;
END;
$$;
```

Also update `handle_employer_onboarding_approval` (currently a no-op) to populate `employee_onboarding.live_employer_id` for all pending employee records:

```sql
CREATE OR REPLACE FUNCTION handle_employer_onboarding_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    -- Stamp live_employer_id on all pending employee onboarding rows for this employer
    UPDATE public.employee_onboarding eo
    SET live_employer_id = e.id
    FROM public.employers e
    WHERE e.onboarding_id = NEW.id
      AND eo.employer_id = NEW.id
      AND eo.live_employer_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
```

---

## Issue 2 — `employee_ewa_settings` holds THREE employer identity columns

### What's happening
`employee_ewa_settings` has:

| Column | FK target | Meaning |
|---|---|---|
| `employee_onboarding_id` | `employee_onboarding.id` | Onboarding-stage employee |
| `employer_id` | `employer_onboarding.id` | Onboarding-stage employer |
| `employer_live_id` | `employers.id` | Live employer |

This means settings can be associated with an onboarding employer *and* a live employer simultaneously, with no enforcement that they refer to the same entity. Queries must know which column to use depending on context (onboarding flow vs. post-approval flow).

### Why it fights
- A settings row created during onboarding uses `employer_id` (→ `employer_onboarding`). After approval, downstream EWA logic reads `employer_live_id` (→ `employers`). If the approval sync doesn't populate `employer_live_id`, the row is invisible to live queries.
- RLS on `employee_ewa_settings` that checks `employer_id` doesn't cover rows accessed via `employer_live_id` and vice versa.
- No constraint ensures `employer_id` and `employer_live_id` point to the same real-world employer.

### Fix
After Issue 1's `live_employer_id` backfill is complete, consolidate:

```sql
-- Step 1: backfill employer_live_id from the onboarding FK if null
UPDATE employee_ewa_settings ees
SET employer_live_id = e.id
FROM employer_onboarding eob
JOIN employers e ON e.onboarding_id = eob.id
WHERE ees.employer_id = eob.id
  AND ees.employer_live_id IS NULL;

-- Step 2: deprecate employer_id column (rename to make explicit it's onboarding-era)
-- Do NOT drop yet — verify application code first
ALTER TABLE employee_ewa_settings
  RENAME COLUMN employer_id TO employer_onboarding_id_deprecated;

COMMENT ON COLUMN employee_ewa_settings.employer_onboarding_id_deprecated IS
  'DEPRECATED 2026-06-24: onboarding-era FK to employer_onboarding.id. Use employer_live_id instead.';

-- Step 3: make employer_live_id NOT NULL once backfill is verified
ALTER TABLE employee_ewa_settings
  ALTER COLUMN employer_live_id SET NOT NULL;
```

---

## Issue 3 — `payroll_*` tables split their employer FK

### What's happening
All four payroll tables point to `employer_onboarding`, not `employers`:

```
payroll_integrations.employer_id  → employer_onboarding.id
payroll_sync_logs.employer_id     → employer_onboarding.id
payroll_upload_rows.employer_id   → employer_onboarding.id
payroll_uploads.employer_id       → employer_onboarding.id
```

But `payroll_upload_rows` also has:
```
payroll_upload_rows.live_employee_id → employees.id   (live table)
payroll_upload_rows.employee_id      → employee_onboarding.id  (onboarding table)
```

Payroll is operational — it runs *after* both sides are approved. It should reference the live tables exclusively.

### Why it fights
- To join a payroll record to advances, fraud_flags, or employer_wallets you must join `payroll_uploads → employer_onboarding → employers` — two hops, and the join breaks if `onboarding_id` is null on `employers`.
- `payroll_upload_rows` mixes `employee_onboarding.id` and `employees.id` in the same row, requiring callers to know the approval state to pick the right join path.

### Fix (requires live data verification first)
```sql
-- 1. Add live FK columns with temporary nullability
ALTER TABLE payroll_integrations ADD COLUMN employer_live_id uuid REFERENCES employers(id);
ALTER TABLE payroll_sync_logs    ADD COLUMN employer_live_id uuid REFERENCES employers(id);
ALTER TABLE payroll_uploads      ADD COLUMN employer_live_id uuid REFERENCES employers(id);
ALTER TABLE payroll_upload_rows  ADD COLUMN employer_live_id uuid REFERENCES employers(id);

-- 2. Backfill
UPDATE payroll_integrations pi
SET employer_live_id = e.id
FROM employer_onboarding eob
JOIN employers e ON e.onboarding_id = eob.id
WHERE pi.employer_id = eob.id;

UPDATE payroll_sync_logs psl
SET employer_live_id = e.id
FROM employer_onboarding eob
JOIN employers e ON e.onboarding_id = eob.id
WHERE psl.employer_id = eob.id;

UPDATE payroll_uploads pu
SET employer_live_id = e.id
FROM employer_onboarding eob
JOIN employers e ON e.onboarding_id = eob.id
WHERE pu.employer_id = eob.id;

UPDATE payroll_upload_rows pur
SET employer_live_id = e.id
FROM employer_onboarding eob
JOIN employers e ON e.onboarding_id = eob.id
WHERE pur.employer_id = eob.id;

-- 3. After app code is updated: rename old columns as deprecated, enforce NOT NULL on live FKs
-- (Same pattern as Issue 2 Step 2–3)
```

---

## Issue 4 — `bank_change_requests.employer_id` → `employer_onboarding`

### What's happening
```
bank_change_requests.employer_id → employer_onboarding.id
```
A bank change request is a post-onboarding operational event — it should reference `employers.id`.

### Fix
```sql
ALTER TABLE bank_change_requests ADD COLUMN employer_live_id uuid REFERENCES employers(id);

UPDATE bank_change_requests bcr
SET employer_live_id = e.id
FROM employer_onboarding eob
JOIN employers e ON e.onboarding_id = eob.id
WHERE bcr.employer_id = eob.id;

-- After app code update:
ALTER TABLE bank_change_requests ALTER COLUMN employer_live_id SET NOT NULL;
ALTER TABLE bank_change_requests RENAME COLUMN employer_id TO employer_onboarding_id_deprecated;
```

---

## Issue 5 — `employer_risk_factors` / `risk_review_requests` → `employer_onboarding`

### What's happening
```
employer_risk_factors.employer_id  → employer_onboarding.id
risk_review_requests.employer_id   → employer_onboarding.id
```
Risk data is continuous — it applies to the live employer entity. Pointing to the onboarding record means risk queries can't join directly to `employer_wallets`, `advances`, or `employer_repayments` without the onboarding → employers hop.

### Fix
Same add-column → backfill → rename-old pattern:

```sql
ALTER TABLE employer_risk_factors ADD COLUMN employer_live_id uuid REFERENCES employers(id);
ALTER TABLE risk_review_requests  ADD COLUMN employer_live_id uuid REFERENCES employers(id);

UPDATE employer_risk_factors erf
SET employer_live_id = e.id
FROM employer_onboarding eob
JOIN employers e ON e.onboarding_id = eob.id
WHERE erf.employer_id = eob.id;

UPDATE risk_review_requests rrr
SET employer_live_id = e.id
FROM employer_onboarding eob
JOIN employers e ON e.onboarding_id = eob.id
WHERE rrr.employer_id = eob.id;
```

---

## Issue 6 — `termination_feedback.employer_id` → `employer_onboarding`

### What's happening
```
termination_feedback.employer_id → employer_onboarding.id
```
Termination is an operational event. Should reference `employers.id`.

### Fix — same pattern as Issues 4 & 5.

---

## Issue 7 — Duplicated identity columns in `employees`

### What's happening
`employees` has both:
- `name text` (nullable)
- `full_name text NOT NULL`

These are kept in sync by `trg_sync_employee_name` (`name := full_name`). The `name` column is a legacy artifact from before `full_name` was added, and its presence means callers may read either column and get different results during any window between INSERT and trigger execution.

### Fix
```sql
-- After confirming no app code reads employees.name directly:
ALTER TABLE employees DROP COLUMN name;
-- Or if a soft deprecation is needed first:
COMMENT ON COLUMN employees.name IS 'DEPRECATED: use full_name. Kept for backward compat; drop in next release.';
```

---

## Issue 8 — `employees.address_proof / bank_statement / employment_contract / payslip_1 / payslip_2 / id_document_front / id_document_back / selfie` are booleans

### What's happening
`employee_onboarding` stores these as `text` (file paths / storage keys). `employees` stores the same fields as `boolean` (document-received flags). This means:

- An employee's actual document locations are only in `employee_onboarding`.
- `employees` can only confirm *whether* a document exists, not retrieve it.
- Any document-retrieval logic must reach back to `employee_onboarding`, defeating the purpose of the sync.

### Fix — two options

**Option A (preferred):** Store storage paths in `employees` too, populated by the sync trigger.
```sql
ALTER TABLE employees
  ADD COLUMN id_document_front_path text,
  ADD COLUMN id_document_back_path   text,
  ADD COLUMN address_proof_path      text,
  ADD COLUMN bank_statement_path     text,
  ADD COLUMN employment_contract_path text,
  ADD COLUMN payslip_1_path          text,
  ADD COLUMN payslip_2_path          text,
  ADD COLUMN selfie_path             text;
```
Then update `sync_employee_from_onboarding` to populate these from `employee_onboarding`.

**Option B:** Keep `employees` as a boolean summary but enforce that any UI/API needing the actual file always queries `employee_onboarding`. Document this contract explicitly so no one adds path-lookup logic to `employees` in the future.

---

## Issue 9 — Duplicate RLS policies on `employees`

### What's happening
`employees` has three overlapping SELECT policies for the employee themselves:

| Policy | Condition |
|---|---|
| `Employees can view own record` | `user_id = auth.uid()` |
| `Users can manage own employee record` (ALL) | `auth.uid() = user_id` |
| `employees_can_read_own_record` | `auth.uid() = user_id` |

`Users can manage own employee record` is an ALL policy — it grants INSERT/UPDATE/DELETE too, which is too broad (employees should not self-insert or delete their own record outside the onboarding flow).

### Fix
```sql
-- Drop the overly-broad ALL policy
DROP POLICY "Users can manage own employee record" ON employees;

-- Keep the specific verb-scoped ones:
-- employees_can_read_own_record (SELECT) ✅
-- employees_can_insert_own_record (INSERT) ✅
-- employees_can_update_own_record (UPDATE) ✅
-- Add DELETE only if employees can self-terminate (probably not):
-- DROP POLICY employees_can_... as appropriate
```

Also `Admins can view all employees` duplicates `admins_have_full_access_to_employees` for SELECT — both use different admin checks (`profiles.role` vs `current_user_is_admin()` which reads `app_metadata`). Only `current_user_is_admin()` is the canonical pattern post-audit.

```sql
DROP POLICY "Admins can view all employees" ON employees;
```

---

## Issue 10 — `employers` has two redundant public-read policies

```
"Allow reading approved employers"  → status = 'approved'
"employers: public read approved"   → status = 'approved'
```
These are identical. One is a duplicate.

```sql
DROP POLICY "Allow reading approved employers" ON employers;
```

---

## Issue 11 — `employers.onboarding_id` nullable — breaks the canonical join path

### What's happening
`employers.onboarding_id uuid REFERENCES employer_onboarding(id)` is **nullable**. Every backfill in Issues 3–6 above relies on `e.onboarding_id = eob.id`. If `onboarding_id` is NULL for any employer row (e.g. employers created directly via admin without going through onboarding), the backfill silently skips them.

### Fix
Before running any backfills, audit:
```sql
SELECT id, company_name, user_id, onboarding_id
FROM employers
WHERE onboarding_id IS NULL;
```
For any NULLs, manually resolve the correct `employer_onboarding` row and set it:
```sql
UPDATE employers e
SET onboarding_id = eob.id
FROM employer_onboarding eob
WHERE eob.user_id = e.user_id
  AND e.onboarding_id IS NULL;
```
Then enforce:
```sql
-- Only after confirming 0 rows remain above
ALTER TABLE employers ALTER COLUMN onboarding_id SET NOT NULL;
```

---

## Issue 12 — `wiza_sessions.employee_id` → `employee_onboarding` (not `employees`)

### What's happening
```
wiza_sessions.employee_id → employee_onboarding.id
```
Wiza sessions are identity-verification events that occur during onboarding, so pointing to `employee_onboarding` is arguably correct. However, once the employee is approved, there is no FK that lets you find all Wiza sessions for a live `employees` row without the join detour.

### Fix (low priority)
Add `employees_id uuid REFERENCES employees(id)` to `wiza_sessions`, populated by the sync trigger after approval, to support direct lookups. Keep the original FK for historical correctness.

---

## Recommended Migration Order

Run these in sequence — each depends on the previous being verified clean.

| # | Migration | Blocker? |
|---|---|---|
| 1 | Fix `employers.onboarding_id` NULLs (Issue 11) | All backfills below depend on this |
| 2 | Add `employee_onboarding.live_employer_id` + backfill (Issue 1) | Issue 2 backfill depends on this |
| 3 | Update `sync_employee_from_onboarding` + `handle_employer_onboarding_approval` (Issue 1) | Live going-forward correctness |
| 4 | Consolidate `employee_ewa_settings` employer columns (Issue 2) | — |
| 5 | Migrate payroll tables to `employer_live_id` (Issue 3) | — |
| 6 | Migrate `bank_change_requests`, `employer_risk_factors`, `risk_review_requests`, `termination_feedback` (Issues 4–6) | — |
| 7 | Drop duplicate RLS policies (Issues 9–10) | — |
| 8 | Drop `employees.name` (Issue 7) | Verify app code first |
| 9 | Decide on document path storage strategy (Issue 8) | Product decision needed |
| 10 | Enforce `employers.onboarding_id NOT NULL` (Issue 11 final step) | After all backfills verified |

---

## Summary Table

| Issue | Tables affected | Root cause | Urgency |
|---|---|---|---|
| 1 | `employee_onboarding`, `sync_employee_from_onboarding` | Sync resolves live employer at runtime via fragile join | 🔴 High |
| 2 | `employee_ewa_settings` | Three employer identity columns, no constraint tying them | 🔴 High |
| 3 | `payroll_integrations/sync_logs/uploads/upload_rows` | Operational tables pointing to onboarding table | 🟡 Medium |
| 4 | `bank_change_requests` | Post-approval event referencing onboarding | 🟡 Medium |
| 5 | `employer_risk_factors`, `risk_review_requests` | Continuous risk data broken from live employer | 🟡 Medium |
| 6 | `termination_feedback` | Post-approval event referencing onboarding | 🟢 Low |
| 7 | `employees` | Redundant `name` column kept in sync by trigger | 🟢 Low |
| 8 | `employees` | Document boolean vs path type mismatch with onboarding | 🟡 Medium |
| 9 | `employees` RLS | Duplicate + over-broad policies | 🔴 High (security) |
| 10 | `employers` RLS | Duplicate SELECT policy | 🟢 Low |
| 11 | `employers.onboarding_id` | Nullable FK breaks every canonical join | 🔴 High |
| 12 | `wiza_sessions` | Onboarding-era FK, no live employee link | 🟢 Low |