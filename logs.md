# EaziWage Update — Payments, Repayments & Onboarding

## 1. Which bank/payment partner are we using? (Stanbic vs. DusuPay)

**Short answer: we're sticking with DusuPay for now — not switching to Stanbic yet.**

- DusuPay is our current, working payment partner. It has actually processed real payouts, and this week's fixes were built and tested against how it really behaves in production.
- Stanbic is a potential future option, but it's still early. Out of 12 features we need working (like mobile money transfers), only 1 has passed testing so far — the rest haven't even been tried yet.
- Stanbic's test environment also broke twice this week, so we don't yet have a clear picture of how reliable it actually is.

**Bottom line:** this isn't a permanent "no" to Stanbic — it's a "not ready yet." We need to see their mobile money features actually work in testing before it's a real alternative.

## 2. Payouts — what got fixed this week

- **Fixed a bug that could double-pay or double-release funds** if a payment request got retried (e.g. due to a network hiccup). Three separate money-moving functions were vulnerable; all three are now locked down properly.
- **Closed a security gap**: a backend function that handles sensitive payment details could technically be called by anyone, without being logged in, and without proper checks. Access has been restricted to internal systems only as an immediate safety measure. A deeper fix is still planned.
- **Found a wrong address bug in our payment provider connection**: our system was pointing at DusuPay's *login page* instead of their actual payment system in test mode. The fix is written but **not yet confirmed live** — this matters because if this has been wrong for a while, it means our system may have been silently failing to check whether payments actually went through.
- **Added better tracking for unclear payment outcomes**: previously, if a payment's result was genuinely unclear (e.g. due to a network failure), our system had no way to record that honestly — it would just get force-labeled as "failed," which isn't always true. Now there are proper states for "unclear" and "sent but not yet recorded on our side."

## 3. Payouts — status (implemented in code)

- DusuPay host/address fix implemented in lib/dusupay/client.ts (default sandbox API: https://sandboxapi.dusupay.com) and validated via env.ts. The consolidated client is in lib/dusupay/client.ts with a thin adapter in lib/dusupay.ts.
- Automated reconciliation and handling for the new "processing_unknown" and "disbursed_pending_ledger" states is implemented in app/api/cron/reconcile-dusupay/route.ts and integrated with lib/services/payout-service.ts. These passes retry ledger RPCs, check DusuPay status, and resolve or release reservations as appropriate.
- The two DusuPay client implementations have been consolidated; webhook handlers and verify routes now use the consolidated client and shared webhook helpers.
- Watchdog/reconciliation fixes are in place: update errors are detected and left unresolved for manual review (not silently counted as resolved), and failed payouts trigger reservation release paths where safe.

Remaining actionable items (ops/verification):

- Deploy & verify: confirm the fixed DusuPay endpoint is live in staging/production by running the webhook integration tests or a reconcile run against the deployed environment.
- Ops blocking: the Kenya treasury wallet negative balance still prevents safe live payout testing — an ops decision to fund or use sandbox is required before end-to-end verification.

## 4. New issue found — blocks real payment testing

**Before we can safely test real payouts, someone needs to make a call on this:**

Our Kenya shilling treasury wallet is currently at **-22,972.95**, and the USD wallet is at **0.00**. There's no wallet at all yet for Uganda, Tanzania, or Rwanda.

This means any real payout test right now would fail immediately on an insufficient-funds check — before we even get to test whether this week's actual fixes work. We traced the negative balance to what looks like test data from a Stanbic-related sync job, but that needs confirming, not assuming.

## 5. Repayments (recovering money owed to us)

- The system now tracks repayments through more detailed stages, and — importantly — it used to overwrite the original amount owed when a partial payment came in, losing the original number entirely. That's fixed; we now keep both the original amount and how much has been collected.
- Fixed the same "double-processing on retry" risk here as in section 2.
- Some scheduling bugs (timezone issues, a query that would keep growing unbounded over time) are fixed in code but **not yet confirmed live**.

## 6. Onboarding

Fixed and confirmed working. Turned out to be a stale reference issue on one side, not a deeper structural problem.