# Annual Access Available Fix — DB State vs Code Change

**Project:** EaziWage (`etfytrhduspebpvybljq`)
**Scope:** Application-layer query fix only. No schema changes.

---

## ✅ Confirmation

The items under "Already Live in the Database" below were verified directly against the Supabase project on 2026-07-23 via `list_tables`, `pg_trigger`, and direct row queries — not assumed, not carried over from a prior session's notes.

**This file is the single source of truth for what exists.** Do not treat a mismatch as license to redesign the schema.

---

## Already Live in the Database (no action needed — do not touch)

| Item                                      | State                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `public.employees` table                  | Exists, 1 row                                                                                                                  |
| `employees.employer_id`                   | NOT NULL, direct FK → `employers.id`, plus `is_live_employer()` check constraint                                               |
| `sync_employee_from_onboarding()` trigger | Fires `AFTER INSERT OR UPDATE` on `employee_onboarding` when `status = 'approved'`; upserts into `employees`                   |
| `employees.kyc_status`                    | Hardcoded to `'approved'` by the trigger on every write — not a meaningful filter                                              |
| `employees.status`                        | The only field that can diverge later (`Active` / `Inactive` / `Terminated`) — this is the real filter                         |
| Current data                              | 1 active employee → Notion Labs, salary 50,000. NS Energy Kenya → 0 approved employees (its onboarding row is still `pending`) |

---

## Code Change Required (application layer only)

| From                                | To                                                  |
| ----------------------------------- | --------------------------------------------------- |
| Source table: `employee_onboarding` | Source table: `public.employees`                    |
| Bridge/two-hop resolution           | Direct join: `employees.employer_id = employers.id` |
| Filter: `kyc_status`                | Filter: `status = 'Active'`                         |
| Aggregation formula/grouping        | **Unchanged** — same logic, new source              |

**Expected output after the fix:** Notion Labs shows 1 active employee / 50,000 salary in the aggregate. NS Energy Kenya shows 0. If the rewritten query doesn't match this, the fix is wrong — flag it, don't push forward.

---

## Hard Boundaries

Do **not**:

- Write or apply any migration
- Alter any table, column, or constraint
- Touch `employee_onboarding`, its trigger, or the trigger function
- Modify `employer_onboarding` or `employers`
- Add new tables, columns, or "improvements" not listed above

This is a query rewrite. Nothing else moves.
