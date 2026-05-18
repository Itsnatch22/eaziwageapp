# EaziWage — Admin & Dashboard Refactor Brief

## Ground Rules (Apply Everywhere)

- **Do not** alter unrelated logic, change routes, or dismantle existing UI components unless explicitly stated below.
- **Currency format:** Use the standardised currency formatter from `/lib/utils.ts` consistently across all admin-side pages and components where monetary values are displayed.
- **Execution order matters** — complete tasks in the order listed. Tasks 2A and 2B are upstream dependencies for several Task 1 bugs. Fix those first.

---

## Priority 0 — Crashes (Fix Before Anything Else)

### P0.1 · `/app/admin/employees`
- **Bug:** `Cannot read properties of null (reading 'toLowerCase')`
- **Fix:** Add null/undefined guard before any `.toLowerCase()` call on employee fields. Likely triggered when an employee record has an incomplete profile. Defensive check required on all string field accesses in this page.

---

## Task 1 — Admin Dashboard: `app/admin`

### 1.1 · `/page.tsx` — Stat Cards: Reconciliation & Risk Scoring
- The **Reconciliation** and **Risk Scoring** stat cards on the main admin dashboard must fetch their data in realtime from their respective source pages:
  - Reconciliation data → `app/admin/reconciliation`
  - Risk scoring data → `app/admin/risk-scoring`
- These should not be hardcoded or use stale fetches. Subscribe to realtime updates.

### 1.2 · `/employers` — Stat Card & Employer Detail Modal

**Stat Card:**
- The **Total Employees** stat card must aggregate only employees belonging to companies that have already been **verified and approved** by the admin (i.e. active/verified employer status). Unverified or pending employers should not contribute to this count.

**Employer Detail Modal — Missing Data:**
- **Employer Code** is not displaying. Ensure it is being read from the correct field in the employers table and passed into the modal.
- **Employees tab** is empty — it is not loading the employees belonging to the selected employer. The query must filter employees by the correct employer foreign key for the selected company.

### 1.3 · `/review-requests` — Review & Resolve Actions
- Reviewing and resolving actions are not functioning.
- Realtime updates appear stuck — resolved/reviewed state changes are not reflecting without a full page reload.
- Ensure state mutations are correctly writing to Supabase and that the realtime subscription is re-triggering the UI after each update.

### 1.4 · `/reconciliation` — Employers Not Appearing & Search Broken
> ⚠️ **Dependency:** This is likely caused by the employee/employer upsert issue described in Task 2B. Resolve Task 2B first before debugging this page.

- Employers are not appearing in the reconciliation page.
- Search is non-functional — this appears to be a downstream consequence of employers not loading.
- Once employers are correctly loading, re-validate the search filter logic.

---

## Task 2 — Employee Upsert Pipeline & Employer Status Sync

> These are root-cause issues. Several bugs in Task 1 are symptoms of the problems described here.

### 2A · Employee Upsert: `employee_onboarding` → `employees`
- Investigate whether employees are correctly upserting from `supabase/employee_onboarding.sql` to `supabase/employees.sql` upon admin approval.
- Compare this flow against how **employers** move from `employer_onboarding` into the `employers` table — the employee pipeline should follow the same pattern.
- Confirm that once upserted, employees are accessible via their respective routes (e.g. admin employees page, CommandPalette search, employer detail modal employees tab).
- **Do not modify any schema files in the `supabase/` folder.**

### 2B · Employer Status Sync: `employer_onboarding` → `employers`
- When an admin sets an employer's status to `active` (or any other status), the change is writing to `employer_onboarding` but is **not reflecting in the `employers` table**.
- The upsert from `employer_onboarding` to `employers` on status change is not functioning as expected.
- Identify where this upsert is triggered (likely an API route or Supabase function) and fix the sync so the `employers` table reflects the current status set by the admin.

### 2C · `components/admin/CommandPalette.tsx` — Employee Search
- Admin cannot search for employees in the CommandPalette.
- This is likely a direct consequence of the employee upsert issue in Task 2A — if employees are not in the `employees` table, they will not appear in search.
- After 2A is resolved, verify that the CommandPalette employee search query is correctly targeting the `employees` table and returning results.

---

## Task 3 — Dashboard References & Department Distribution

### 3.1 · Cross-Dashboard Route References
- Audit and align references between:
  - `app/dashboards/employee-dashboard` and its routes
  - `app/dashboards/employer-dashboard` and its routes
- Identify any broken links, incorrect route paths, or mismatched data references between the two dashboards.

### 3.2 · Department Distribution — Employee Activation
- Clarify and fix how **department distribution** is determined when an employee account is activated.
- Currently, all employees appear to be falling under **"General"** regardless of their actual department.
- Investigate: Is the department field being set during employee onboarding? Is it being carried through the upsert from `employee_onboarding` to `employees`? Is the dashboard reading from the correct field?
- Expected behaviour: Upon activation, an employee's department should reflect what was captured during onboarding — not default to a catch-all category.

---

## Summary of Execution Order

| Order | Task | Reason |
|-------|------|--------|
| 1st | P0.1 | App is crashing — fix first |
| 2nd | 2A | Upstream: employees not upserting affects multiple pages |
| 3rd | 2B | Upstream: employer status not syncing affects reconciliation + employers page |
| 4th | 2C | Depends on 2A being resolved |
| 5th | 1.1 – 1.4 | Most of these unblock after 2A and 2B are fixed |
| 6th | 3.1 – 3.2 | Dashboard audit — cleaner to do after core data pipeline is correct |