# Platform Process Review

**Review date:** 2026-10-24  
**Supabase verification:** ✅ Follow-up migration objects and ACLs were verified read-only on 2026-10-24 after the user applied it manually.  
**Scope:** Static review of authentication/authorization, employee advances, payment-method PII, DusuPay webhook processing, employer wallet funding, support operations, and related tests; plus read-only verification of the relevant live Supabase objects and privileges. Findings are ordered by severity.  
**Limitations:** The assistant did not execute database changes. The user applied `supabase/migrations/20261024170000_harden_webhook_claims_and_pii_vault.sql` manually. Post-migration schema and ACLs were verified read-only. A read-only check did not find the expected `PII_ENCRYPTION_KEY` name in Vault metadata; staging runtime tests remain the confirmation of secret resolution and PII behavior. The secret value was not accessed. Vercel project settings and DusuPay sandbox callbacks were not tested.

## Summary

The platform has useful controls in place, including recent-MFA checks on advance and payment-method actions, ownership checks for payment methods, database-backed transaction routines, and HMAC/timestamp validation for DusuPay callbacks. The user applied the follow-up migration; its key schema objects and ACLs are now verified. A metadata query did not show the expected Vault secret name; controlled staging tests will establish whether secret resolution, PII operations, and webhook replay/retry behavior work as expected.

| Severity | Count |
| --- | --- |
| Critical | 0 |
| High | 3 |
| Medium | 0 |
| Low | 1 |

## Resolved

- ✅ **H1 — User-editable auth metadata can satisfy admin authorization:** `checkAdminAccess` now considers only the trusted `profiles.role` and server-controlled `app_metadata.role` sources (besides the `system_admins` check). Regression tests confirm a forged `user_metadata.role = admin` does not grant access and a trusted profile admin role still does.
- ✅ **M1 — Pending employer wallet collections are recorded as failed:** collection handling now uses canonical normalized statuses and persists a pending callback as `pending`; the wallet is credited only for a completed callback.
- ✅ **M2 — Webhook integration tests do not verify financial idempotency or ledger outcomes:** focused route tests mock the claim and financial RPCs and assert exactly one wallet-credit RPC on replay, retryable HTTP 500 plus claim release on credit failure, pending-state persistence, and fail-closed claim errors.

## Supabase verification summary

Read-only baseline checks against the live Supabase project on 2026-10-24, before the follow-up migration, showed:

- `public.acquire_dusupay_webhook_claim` and `public.dusupay_webhook_claims` exist. The claim RPC is `SECURITY DEFINER`, has a fixed `search_path`, and is executable by `service_role` only; `public`, `anon`, and `authenticated` have no execute privilege.
- The claim table has RLS enabled and no policies, so API roles currently have no row access through RLS. However, its table ACL grants `SELECT`, `INSERT`, `UPDATE`, and `DELETE` to both `anon` and `authenticated`; see L1 for least-privilege cleanup.
- `public.get_payment_method_pii(uuid)` and `public.upsert_payment_method_pii(uuid, text, text)` exist with the new signatures. They are `SECURITY DEFINER`, use a fixed `search_path`, and are executable by `service_role` only. No raw `p_key` argument remains.
- Before the follow-up migration, `app.pii_encryption_key` was absent from the verification session and database-/role-level settings, so the old PII functions could not resolve a key. The migrated functions resolve it from Supabase Vault.
- The live money RPCs (`fund_employer_from_admin`, `credit_employer_wallet_prefunded`, `repay_advance_to_admin`) are `SECURITY DEFINER` and executable by `service_role` only. No `public`, `anon`, or `authenticated` execute privilege was found.
- The deployed `acquire_dusupay_webhook_claim` body matches the migration's current reclaim logic: it returns `claimed: true` after a conditional update without checking whether a row was updated. The migration's presence therefore does not resolve the concurrent stale-claim race described in H2.

Post-migration read-only checks on 2026-10-24 confirmed:

- `dusupay_webhook_claims.claim_token` exists, is `NOT NULL`, and defaults to `gen_random_uuid()`.
- The claim acquire/finalize, PII, and funding RPCs exist as `SECURITY DEFINER`; `service_role` can execute them, while `PUBLIC`, `anon`, and `authenticated` cannot.
- `dusupay_webhook_claims` has RLS enabled; `anon`, `authenticated`, and `PUBLIC` have no CRUD grants, while `service_role` has CRUD grants.
- The PII RPC definitions use `vault.decrypted_secrets`, `pgp_sym_*`, and the fixed `pg_catalog, public, extensions` search path.
- A name-only query to `vault.secrets` returned no `PII_ENCRYPTION_KEY` row. No value was selected. Confirm effective secret resolution during the pending staging PII tests.

## High severity

### H2 — Webhook claim failure paths fail open, and stale-claim reclaim is not atomic

**Verified prior state:** The live claim function's conditional reclaim update returned `claimed: true` without checking whether it updated a row. The previous route also treated RPC errors and unknown responses as permission to proceed. Both sides are addressed by the current code and the new staged migration.

**Current implementation:** The route now fails closed on RPC errors or malformed responses, requires a claim fencing token, returns HTTP 503 for an in-progress duplicate so the provider retries, and finalizes successful claims or releases failed claims for retry. The migration provides atomic token-based reclaim/finalization and restricts the table/RPC grants; these post-migration schema and ACL controls were verified read-only.

**Impact:** The application expects the migrated claim RPC contract. Application/database behavior still needs replay and retry verification in staging.

**Recommendation:** Verify concurrent claim behavior and token-checked finalization against a staging database.

### H3 — Callback handler can acknowledge a completed event after ledger processing failed

**Evidence:** Previously the route acknowledged callbacks after some handler failures. The route now propagates errors from repayment, employer funding, wallet-credit, and payout-ledger work, persists the callback record only after handler success, and releases the claim for a provider retry on failure. The follow-up migration also makes employer-wallet funding RPC effects idempotent across claim lease retries. Payday recoupment failures remain durably marked for manual ledger reconciliation and are not automatically re-applied on provider retries.

**Impact:** The code and migration address the reported failure mode; staging verification should confirm retries cannot duplicate ledger effects after lease expiry.

**Recommendation:** Verify failure/retry and duplicate callback behavior in staging.

### H4 — PII RPCs require a database setting that the repository never configures

**Evidence:** Before the follow-up migration, the live functions read `current_setting('app.pii_encryption_key', true)`. That setting was absent from the verification session and database-/role-level settings. Application callers use the keyless RPC signatures. The applied migration changes the lookup to Supabase Vault.

**Live DB verification:** Before the follow-up migration, the live functions required the absent custom setting. The post-migration PII function definitions now read from `vault.decrypted_secrets` and have service-role-only execution. A name-only check of `vault.secrets` did not find `PII_ENCRYPTION_KEY`, despite the user's report that it is configured. The key value was not queried.

**Impact:** The code/schema change is verified, but effective key resolution has not been tested. Payment-method PII reads/writes and payout destination lookup still require a controlled runtime test.

**Recommendation:** Verify read/write/payout paths in staging. Do not expose or rotate the key; a different value makes existing encrypted PII unreadable.

## Verified migration control

The previously reported H5 concern—missing execute restrictions on the `SECURITY DEFINER` claim RPC—was verified resolved before the follow-up migration and remains restricted to `service_role`. Post-migration claim-table API-role grants are absent, RLS remains enabled, and claim/finalize plus money/PII RPC execution privileges are restricted to `service_role`.

## Low severity

### L1 — Claim table has broad API-role grants despite RLS currently denying row access

**Live DB verification:** Before the migration, `public.dusupay_webhook_claims` had RLS enabled and no policies, but its table ACL granted all four CRUD privileges to `anon` and `authenticated`. After the manual migration, RLS remains enabled, those roles and `PUBLIC` have no CRUD grants, and `service_role` retains CRUD access.

**Impact:** RLS currently blocks direct API-role row access, so no direct exposure was observed. The broad grants are unnecessary and could become hazardous if a policy is later added or RLS is changed.

**Recommendation:** No further ACL change is indicated by the post-migration check; retain the least-privilege grants and RLS configuration.

## Positive controls observed

- Advance requests and payment-method changes require recent MFA (`app/api/employee-dashboard/request-advance/route.ts`; `app/api/employee-dashboard/payment-methods/route.ts`).
- The advance request validates employee ownership of its payment method and checks employer verification/freeze/default status before creating the advance (`request-advance/route.ts`).
- The DusuPay client validates timestamped HMAC signatures with a bounded age and timing-safe comparison (`lib/dusupay/client.ts:225-258`).
- Payment-method service responses mask decrypted values and strip encrypted columns before returning rows (`lib/paymentMethodsService.ts:8-30`).

## Review disposition

This is a review report, not a release approval. Post-migration schema/ACL verification is complete; the remaining Vault, staging, provider replay/idempotency, and ledger-reconciliation gates must be confirmed through actual environment testing before enabling live money paths.
