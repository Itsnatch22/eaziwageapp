From `/dusupay.md` 

What's solid

Synchronous-in-request dispatch confirmed, no queue/cron doing outbound calls — matches the data.
The .eq('status', 'approved') stale-filter bug is real and independently verifiable from the code alone: whatever else is true, that recovery UPDATE matches 0 rows once status has already flipped to processing. Fix that regardless of what else is going on.

What's not proven yet

The report presents "floating promise gets frozen by serverless container recycling" as the primary cause, but everything backing it is inference from reading the code — not a log line, trace, or timing measurement showing the container actually froze mid-execution. There's a second hypothesis that explains the exact same DB evidence just as well:

H1 (their claim): disburseAdvance never even reaches dusupayClient.sendFunds() — killed by container freeze before the network call fires.
H2 (unaddressed): sendFunds() is called, it throws (bad sandbox credentials, wrong endpoint, network unreachable — anything), the .catch() handler fires as designed, and then the stale filter bug (bug #2) silently eats the recovery update. Same result: stuck at processing, zero dusupay_transactions rows, zero internal_reference.

These look identical from the database. They are not identical in what you do next. H1 is an execution-model bug — fix the async handling and disbursement starts working. H2 is a DusuPay integration problem wearing the SQL bug as a disguise — fix the async handling and you'll just get advances cleanly marked failed instead of stuck, while disbursement still doesn't work, because the actual call to DusuPay is broken.

Before Task 2 gets written: pull the actual Vercel function logs (or wherever payout-service.ts logs to) for the timestamp of the July 28 stuck record and today's. If sendFunds logged an outbound call, a response, or a thrown exception — that's H2, and the DusuPay connectivity/credentials need investigating directly, separate from the async bug. If there's no log entry at all past the reservation, that's H1. Don't let this get merged as "fixed" on code-reading alone.

On the fix itself, ranked — and I'd reject the framing in the report's Task 2 as written:

Rank	Approach	Verdict
1	Decouple dispatch from the request/response cycle entirely — reservation succeeds, request returns immediately, a background job (queue consumer, not a floating promise) picks up the disbursement call with its own retry/timeout handling	Correct architecture. An external payment-rail call has no business living inside a synchronous serverless handler at all — that's the actual disease, the freeze is just the symptom. Also sidesteps H1 entirely: nothing to freeze if the call isn't hostage to the HTTP lifecycle.
2	Properly await the call in the handler (plus a platform safety net like Next's after()/Vercel waitUntil if you're not ready to build a queue)	Acceptable only as a stopgap. It makes the user wait on DusuPay's latency inside a dashboard click, and — critically — if the client times out and retries the approval action, you now need to guarantee that doesn't double-dispatch to DusuPay.
3	Just fix the .catch() filter bug and call it done	Reject. This only makes failures visible correctly — it does nothing to guarantee the call itself completes reliably. Papers over the symptom the report actually found.

Whichever rank you pick, one thing is non-negotiable and wasn't in the report at all: idempotency. If a retry (manual, client, or future watchdog) can re-trigger disburseAdvance for the same advance, and there's no idempotency key recognized by DusuPay or a dedupe guard on our side keyed to the advance ID, a retry after a false "it failed" reading could disburse twice. Given this codebase's own prior pattern — idempotency guards must exist before any balance-mutating retry path — that needs to be checked before Task 2 ships, not after.

One more connection worth surfacing: the existing retry-button bug on the employer dashboard (always submits action: 'approve', non-functional for failed disbursements) is directly downstream of this. Once bug #2 is fixed and advances correctly land in failed, that retry button becomes the actual recovery path someone will click — and right now it doesn't do anything useful for a failed disbursement. Worth fixing in the same pass, not a separate ticket that gets forgotten.

Task 4 stands as-is — if it turns out to be H2, that raises the stakes on those two specific records: a real call may have been attempted against DusuPay for one or both, which makes an actual DusuPay-side transaction lookup (not just internal DB state) the right first move before touching either reservation.