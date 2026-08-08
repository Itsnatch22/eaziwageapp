# Prompt — Disbursement reconciliation worker, client consolidation, webhook hardening

## Context: what's already true in the DB, don't re-derive or re-decide these

- `advances.status` now legally accepts two new values: `disbursed_pending_ledger` (DusuPay confirmed the payout, but `record_employee_disbursement_from_treasury` failed to record it — money moved, ledger didn't) and `processing_unknown` (both the initial `sendFunds` call and the `verifyTransaction` retry failed at the network level — genuinely unknown whether money moved). These are distinct on purpose. Do not collapse them into one status or treat them interchangeably.
- `release_employer_reservation(p_employer_id, p_amount, p_advance_id)` was just fixed for idempotency — it's now safe to call more than once for the same advance; a repeat call correctly no-ops instead of double-releasing. You can call it freely without adding your own dedupe layer around it.
- `get_payment_method_pii` had `anon`/`authenticated`/`PUBLIC` execute revoked — it's `service_role`-only now. If anything you touch was relying on calling this from a non-server context, that's now broken on purpose; route it through a server-side call instead, don't re-grant access to patch around it.
- `record_employee_disbursement_from_treasury` was already fixed for idempotency in an earlier pass (lock → guard → mutate) — safe to retry.

## Task 1 — Treasury RPC failure after confirmed payout → `disbursed_pending_ledger`

Find the point in `disburseAdvance` (or wherever `record_employee_disbursement_from_treasury` is called after `dusupayClient.sendFunds()` succeeds) where the RPC call can fail. Currently this likely marks the advance `failed` and notifies admin. Change it:

- On RPC failure **after DusuPay has confirmed the payout succeeded**, set `advances.status = 'disbursed_pending_ledger'`, not `'failed'`.
- **Do not call `release_employer_reservation` for this path.** The money already left — the reservation represents real, already-disbursed funds now owed back through repayment, not a hold that should be freed. Releasing it here would let the employer's available balance look higher than it actually is while real money is already out the door. This is the one place in this task list where reusing the "release on failure" pattern from elsewhere would be actively wrong — call it out in a comment so the next person doesn't "fix" it back.
- Include `merchantReference`/`internalReference` in whatever gets logged or surfaced, so a human (or the reconciliation job in Task 3) can find the record without hunting.

## Task 2 — Network-level ambiguity → `processing_unknown`

Find where `DusupayNetworkError` is caught and the code falls back to `verifyTransaction`. If *that* also fails/errors (not "returns a definitive failed status" — actually errors, meaning we got no answer at all):

- Set `advances.status = 'processing_unknown'`, not `'failed'`.
- **Do not touch the wallet reservation here either.** We don't know if the money moved. Releasing it now and having it turn out DusuPay actually completed the payout would be the exact double-exposure problem this whole task list exists to prevent.
- The only way out of `processing_unknown` is Task 3 actually determining a real outcome — don't let any other code path (manual admin action, a different cron, a UI button) transition out of this status without going through the same determination logic, or you'll fragment the reconciliation logic across multiple places that can disagree with each other.

## Task 3 — Reconciliation worker

**Extend the existing `app/api/cron/reconcile-dusupay/route.ts` cron rather than introducing new infrastructure** (a queue system like BullMQ, a separate service, etc.). The codebase already has a working pattern here — bounded queries, rate-limited DusuPay calls, `notifyAdmin` on genuinely stuck cases, mismatches logged to a queryable table. Reuse it; don't build a second system that has to stay in sync with the first.

Add two passes, following the same shape as the existing `checkStuckProcessingAdvances`:

- **`disbursed_pending_ledger` pass**: for advances in this state, retry `record_employee_disbursement_from_treasury`. It's already idempotent, so a retry is safe. On success, transition to whatever your normal terminal "successfully disbursed" status is — resolve the `'completed'` vs `'disbursed'` naming question from last session's review before writing this, don't introduce a third variant.
- **`processing_unknown` pass**: call `dusupay.checkPayoutStatus` (or `verifyTransaction`) to actually determine the outcome.
  - If DusuPay confirms success → transition to `disbursed_pending_ledger` and let the first pass (or the same run) handle the ledger RPC from there. Don't try to do both steps inline in a way that duplicates Task 1's logic — reuse it.
  - If DusuPay confirms failure → transition to `'failed'`, **and this is the one case where you should call `release_employer_reservation`** — money genuinely never moved, the hold should be freed.
  - If still indeterminate → leave as `processing_unknown`, let the next run try again. Don't force a terminal state just because it's been a while; a wrong terminal state here is worse than staying uncertain.

**Non-negotiable, because we just found this exact bug in the existing watchdog**: check the `{ error }` return on every Supabase write in this new code. Do not let a failed write get silently counted as a successful resolution the way `checkStuckProcessingAdvances` currently does — if you're touching that function anyway for the naming-consistency fix above, fix its unchecked writes at the same time rather than leaving two versions of the same bug in the same file.

## Task 4 — Consolidate the two DusuPay clients (`lib/dusupay.ts` vs `lib/dusupay/client.ts`)

**Diagnose before merging.** Diff the two files and report back: what's actually different — headers, endpoint URLs, error handling, retry behavior, timeout values? Don't assume they're accidental duplicates; one may have been intentionally forked for the webhook/verify path versus the send-funds path, per the original report's caveat. If they've genuinely drifted (different header casing, different timeout, different error mapping), that's the real bug — report exactly what's out of sync before deciding whether to merge them into one client or formalize the split with shared types and parity tests.

## Task 5 — Webhook signature header hardening

`dusupay-signature` header lookup should be case-insensitive (Node's header handling usually lowercases automatically depending on how you're reading it — verify how the current code accesses the header and confirm it's not doing an exact-case string match against a header object that could arrive differently cased). Add defensive logging for unparsable signature formats — log a truncated sample of the raw payload and the header value received, not just "signature invalid," so a real integration issue is diagnosable from logs instead of requiring a repro.

## Task 6 — Major items from the original review

- **Repayment schedule failure path**: confirm `release_employer_reservation` is called correctly when schedule creation fails, and that it's audit-logged. It's idempotent now (Task-1-adjacent fix already applied), so a retry here is safe — just confirm the call site actually happens and isn't silently skipped on some branch.
- **Audit/alert metadata**: every `notifyAdmin` call across `advance-approval.ts`, `advances/[id]/route.ts`, and the DusuPay routes should carry `merchantReference`/`internalReference` and a plain-language suggested next action, not just a bare error message. Someone reading the alert at 2am shouldn't have to go trace the code to know what to do next.
- **Typed results for external API responses**: replace `any`/raw parsing of DusuPay responses with actual types where you touch these files anyway. Don't do a repo-wide sweep for this as part of this task — just the files already in scope above.

## Non-negotiables

- Every new balance-adjacent write follows the established pattern: row lock → existence check → idempotency guard → mutation. We've now fixed this exact ordering bug five times in this codebase (`record_employee_disbursement_from_treasury`, `transfer_admin_treasury_funds`, `repay_advance_to_admin`, `repay_employer_liability_to_admin`, `release_employer_reservation`) — a sixth occurrence in new reconciliation code is not acceptable.
- No swallowed Supabase write errors anywhere in this task list.
- Do not merge or deploy Tasks 1–3 without sign-off — they change what happens to real disbursed money and real wallet reservations. Tasks 4–6 are lower-risk and can move independently.
- If Task 4's diff turns up a behavioral difference between the two DusuPay clients beyond cosmetic naming, stop and report it before merging — a silent behavior change during "just consolidating duplicate code" is how the report's Critical #3 becomes a Critical #1.