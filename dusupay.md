 Reviewing Task Clarity
  ### Task 1 Findings Report — Missing DusuPay Dispatch Step

  We have completed the investigation into the missing DusuPay dispatch step and identified the root cause of why advances get stuck in status =
  'processing' without ever hitting DusuPay.
  ──────
  ### 1. Is dispatch synchronous or handled by a separate job/queue/worker?

  Synchronous.
  In both manual approval (app/api/employer-dashboard/advances/[id]/route.ts) and auto-approval (lib/services/advance-approval.ts),
  payoutService.reserveFunds(...) is called synchronously, and immediately followed by calling payoutService.disburseAdvance(id).
  ──────
  ### 2. Is there a separate job/queue/cron for dispatch?

  No such job exists.
  There is no queue consumer, background worker, or scheduled cron job that selects advances in status = 'processing' (or missing reference /
  internal_reference) to dispatch them to DusuPay.

  (The existing app/api/cron/reconcile-dusupay cron job only cross-checks advances that already have a non-null reference set; it does not perform
  outbound dispatches).
  ──────
  ### 3. Exact call site & why the dispatch failed / got stuck

  • Exact Call Site: payout-service.ts invoking dusupayClient.sendFunds({...}) at line 757 of lib/services/payout-service.ts.

  #### Direct Root Causes Identified:

  1. Un-awaited Floating Promises in Serverless Route Handlers (Primary Cause)
  In both app/api/employer-dashboard/advances/[id]/route.ts (line 255) and lib/services/advance-approval.ts (line 153), disburseAdvance is invoked
  as a floating, un-awaited promise:
    payoutService.disburseAdvance(id).catch(async (err) => { ... });
    In Next.js / Vercel serverless environments, as soon as the API response is returned to the client, the serverless execution context is
  immediately frozen/terminated. disburseAdvance begins execution, updates the database status of the advance to 'processing', and is then
  frozen/terminated before dusupayClient.sendFunds(...) can execute or receive a response.
  2. Flawed Error Handler SQL Filter (.eq('status', 'approved'))
  When disburseAdvance begins, its very first operation (line 380 of payout-service.ts) is:
    UPDATE advances SET status = 'processing' WHERE id = advanceId AND status IN ('pending', 'approved');
    However, all .catch() error handlers in callers (advances/[id]/route.ts, advance-approval.ts, and retry-disbursement/route.ts) attempt error
  cleanup using:
    await supabaseAdmin.from('advances').update({ status: 'failed', reason }).eq('id', id).eq('status', 'approved');
    Because status was already mutated to 'processing' by disburseAdvance, .eq('status', 'approved') matches 0 rows. Any failure during
  disbursement silently fails to update the record to 'failed', leaving the advance permanently stuck in 'processing'.
  3. Lack of Timeout Tracking / Watchdog Recovery
  If an outbound call times out or encounters network degradation, the record remains in 'processing' with no alert, timeout status, or watchdog
  mechanism.
  ──────
  ### Next Steps / Proposed Resolution Plan (Tasks 2, 3 & 4) — COMPLETED

  Based on these findings, all tasks have been completed:

  1. Task 2 (Synchronous Call & Outcome Guarantee) - [x] COMPLETED:
      • Awaited `disburseAdvance` properly in all approval paths (`app/api/employer-dashboard/advances/[id]/route.ts` and `lib/services/advance-approval.ts`) so serverless functions do not terminate mid-dispatch.
      • Fixed the `.catch()` status filters across all call sites (`route.ts`, `advance-approval.ts`, `retry-disbursement/route.ts`) from `.eq('status', 'approved')` to `.in('status', ['approved', 'processing'])` so failures properly transition advances to `failed` and release wallet reservations.
      • Added pre-check idempotency verification in `lib/services/payout-service.ts` using `dusupayClient.verifyTransaction(merchantReference)` before invoking `sendFunds`, preventing double payouts on retries.
      • Fixed the Employer Dashboard Retry button (`app/dashboards/employer-dashboard/advances/page.tsx`) to render specifically for `failed` advances, allowing proper re-attempt of approval and disbursement.

  2. Task 3 (Alerting & Timeout Monitoring) - [x] COMPLETED:
      • Extended the cron monitor (`app/api/cron/reconcile-dusupay/route.ts`) with `checkStuckProcessingAdvances` watchdog to detect advances sitting in `processing` > 15 minutes.
      • Automatically checks live DusuPay status for stuck processing advances with references and triggers an immediate admin alert (`notifyAdmin`) for any unresolved stuck records.

  3. Task 4 (Anchor Records Manual Review) - [x] COMPLETED:
      • Queried database & DusuPay API for anchor records `110b6a27-61fa-4231-99a3-c1229b1574b3` and `7b987721-b7a9-46c8-82a4-6496f2ab6743`.
      • DusuPay API confirmed `404 Transaction Not Found` for both merchant references (`ADV110b6a2761fa423199a3c1229b1574b3` and `ADV7b987721b7a946c882a46496f2ab6743`), proving Hypothesis H1: container was frozen prior to firing `sendFunds`. No funds were sent by DusuPay.
      • Surfaced anchor records for manual review & wallet reservation release (40,000 KES total reserved in `employer_wallets`).
