# EaziWage money-path launch checklist

## Completed tasks

- [x] Task 1 — Add an atomic webhook claim to block duplicate callback processing before money logic runs.
- [x] Task 2 — Canonicalize DusuPay status handling and fail closed on invalid signatures and allowlists.
- [x] Task 3 — Remove raw decryption-key arguments from payout RPC paths and use a server-side secret path.
- [x] Task 4 — Add replay/concurrency and partial-write regression checks for the hardened webhook path.

## Remaining tasks

- [ ] In staging, verify PII reads/writes and payout destination lookup; use the runtime results to confirm Vault secret resolution. A read-only catalog check did not find the expected name, but no secret value was accessed.
- [ ] Verify concurrent DusuPay replay, processing failure/retry, and ledger idempotency against a controlled staging database and provider sandbox.
- [ ] Task 5 — Verify DusuPay idempotency guarantees in sandbox and reconcile any unresolved transactions before live-funds enablement.
- [ ] Task 6 — Complete the final release sign-off only after the sandbox replay and reconciliation checks pass.

## Platform review remediation

- ✅ H1 — Admin authorization no longer treats user-editable `user_metadata.role` as a trusted admin role; regression tests cover forged metadata and trusted profile roles.
- ✅ H2 — Application claim acquisition now fails closed, returns retryable HTTP 503 for in-progress duplicates, and requires a fencing token; post-migration token column, claim RPCs, service-role-only execution, and claim-table grants/RLS were verified read-only in Supabase.
- ✅ H3 — Webhook ledger failures now return retryable errors; funding RPCs are idempotent across claim retries, and payday recoupment ledger failures are held for reconciliation instead of being automatically replayed.
- ✅ H4 — Post-migration Vault-backed PII RPC definitions and service-role-only execution were verified read-only. A metadata check did not find the expected Vault name; staging runtime tests will confirm whether secret resolution and PII operations work. The secret value was not accessed.
- ✅ M1 — Pending employer collections remain pending and are not credited.
- ✅ M2 — Route tests assert exactly-once wallet-credit invocation on replay, retry/release after ledger failure, pending persistence, and fail-closed claim errors.
- ✅ L1 — The applied migration revokes unnecessary anon/authenticated CRUD grants on the claim table.

## Notes

- The first four tasks describe the original implemented money-path hardening set; follow-up code fixes, post-migration schema/ACL verification, and unit tests are complete. The remaining Vault, staging, and provider gates will be confirmed by actual environment testing.
- Task 5 and Task 6 remain external release gates and cannot be completed by repository changes alone.
- The SQL was run manually by the user. Post-migration objects and ACLs were checked read-only. A name-only Vault metadata check did not find `PII_ENCRYPTION_KEY`; runtime staging checks remain authoritative, and no secret value was selected.
*last dated 2026-10-24*
