
 - Run an integration test or exercise the request-advance route to confirm inserts succeed without organization_id.
 - Later: add a migration to either drop the column or remove/adjust any FK/indexes when Tier 2 is ready.

  - Test approving a top-up to confirm admin_wallet decreases and employer_wallet increases as expected.
 - Consider adding a guard to prevent admin_wallet going negative (check balance before UPDATE) and wrap the function in a transaction/raise exception on insufficient funds


 - Approve a top-up with sufficient admin balance — admin balance should decrease and employer wallet increase.
 - Approve a top-up with insufficient admin balance — RPC should raise and the approval route must handle the error (HTTP 500/400 → surface a friendly message).

  - Implement a mapping table + migration and update disburseAdvance() to use it.
 - Add unit tests for mappings and one integration test for sendFunds.
 - After FIX-01–04 deploy, run integration tests and exercise end-to-end.

- Attempt to set wallet_transactions.status = 'failed' for reference = ADV-RESERVE-{advanceId} when disbursement errors occur.
 - Log any error from that update but continue to mark the advance as failed.

Recommendation: Run the disburseAdvance unhappy-path integration test (simulate dusupayClient.sendFunds throwing) to verify the reserve transaction no longer remains pending.

- Run integration tests and exercise admin flows (top-up, disburse, fraud rules, sync) to confirm auth behavior.
 - Search codebase for callers of deprecated endpoints and update to use the consolidated authenticated routes.
 - If desired, convert the 410 stubs to actual file deletions in a follow-up commit.


 - This is FIX-17 applied in-place. It prevents new employer approvals from writing to the legacy organizations schema.
 - Next: perform FIX-18 (drop dead tables and their RLS policies) and FIX-19 (drop vestigial columns) in sequence. Do NOT drop tables before the trigger is stripped — that would cause the trigger to raise errors.
 - Suggest running a smoke test: approve an employer onboarding in a staging environment to confirm no organizations/inserts/backfills occur and no errors are raised.
 - If desired, create migration SQL for FIX-18/FIX-19 and I can apply them next.


 - verify-email route already updates profiles.email_verified = true and marks the email_verifications token used, so the verification flow is now functional.
 - The Supabase user was previously created with email_confirm: true (line 336). If desired, flip that to false so Supabase's user record matches the app-level verification flow — ask if you want that change too.
 - Recommend running a signup → verify-email end-to-end test in staging to confirm behavior (auto sign-in still occurs in register; consider whether auto sign-in before email verification is acceptable).


  - Run a quick test sending a webhook without signature (expect 401).
 - Run a valid signed webhook test to confirm normal processing still works.
 - Consider making the IP check block (not just warn) if stricter control is desired.

 - There are more routes that expose raw error.message; consider a follow-up sweep or adding a small utility (e.g., safeErrorResponse(res, keyMessage, err)) to standardize responses project-wide.
 - Run integration tests and smoke checks for the modified routes (employer wallet, credit, payout providers, public employers)