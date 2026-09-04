DusuPay: Host Fix (Part A) + Client Consolidation (Part B)

Summary
- Date: 2026-08-08
- Commit: a8feedb (pushed to main)
- Purpose: Fix immediate sandbox host bug (Part A) and consolidate two DusuPay clients into a single robust client (Part B). This document records rationale, changes, verification, tests, and next steps.

Part A — Immediate host fix
- Problem: Default sandbox host in code pointed at sdbxportal.dusupay.com (merchant dashboard HTML), causing non-JSON responses and hiding the real error.
- Fix: Default sandbox base URL changed to https://sandboxapi.dusupay.com in both client and adapter entrypoints.
- Risk: Low; one-line default change. Shipped immediately per request.
- Files changed (high-level): lib/dusupay/client.ts (sandbox default updated), lib/dusupay.ts adapter usage verified.

Part B — Consolidation (client merge & improvements)
Goals preserved from both prior implementations:
1. Preserve distinct network-vs-API error classification (DusupayNetworkError) so reconciliation logic can mark processing_unknown vs. confirmed failures.
2. Read response as text then JSON.parse to provide diagnostic message when a non-JSON body is returned.
3. Normalize headers handling and explicitly decide secret-key behavior after verifying sandbox.
4. Keep webhook helpers (verifyWebhookSignature, parseWebhook) available as standalone exports (not forced into client instance).
5. Carry forward MOBILE_MONEY_PROVIDERS with documented caveats for unverified markets.

Key implementation details
- New consolidated client: lib/dusupay/client.ts
  - DusupayClient class with request(), sendFunds(), verifyTransaction(), checkPayoutStatus(), initializeCollection(), getWalletBalances(), getPaymentProviders(), getBankCodes().
  - DusupayNetworkError class thrown only when fetch() fails (DNS/timeout/connection), allowing callers to treat outcome as "unknown".
  - request() reads response.text(); JSON.parse wrapped in try/catch and throws a diagnostic error containing URL, status, and truncated body on non-JSON responses.
  - Headers normalized to a Record<string,string> and typed as HeadersInit at call sites to satisfy TypeScript.
  - Header behavior: 'secret-key' header included only when set. An env flag DUSUPAY_INCLUDE_EMPTY_SECRET=true exists to force sending an empty secret for testing if required.
  - isConfigured getter added (boolean) to match previous call-site expectations.
- lib/dusupay.ts now a thin adapter re-exporting MOBILE_MONEY_PROVIDERS, types, webhook helpers, and exposing dusupay.checkPayoutStatus(...) and dusupay.isConfigured for backward compatibility.

TypeScript and call-site fixes
- checkPayoutStatus now returns structured { success, message, status, internalReference, merchantReference, errorCode?, raw } — includes errorCode='STATUS_ERROR' for API-level failures and rethrows DusupayNetworkError for network-level failures.
- Added DusupayClient.get isConfigured(): boolean so existing code reading dusupay.isConfigured (or calling an adapter fn) compiles.
- Normalized imports for dusupay types (lib/dusupay/types.ts) and fixed prior wrong './types' path.

Verification & Tests
1. Grep for DUSUPAY_SANDBOX_BASE_URL in repo: none overriding the default found in repo files (README mentions the var as an override key).
2. Live sandbox header verification (used .env.local values): docs/dusupay-sandbox-header-verification.md created with safe curl steps.
  - Provider list endpoint responded with JSON errors when required headers absent.
  - Verify endpoint returned 404 "Transaction ... Not Found" for test reference in all header permutations; the sandbox returns JSON (no HTML). 
  - Conclusion: sandboxapi.dusupay.com is the correct API host; non-JSON portal responses no longer occur when using this host.
3. Unit tests
  - Ran npm run test:unit (vitest). Initially one integration-like test failed because valid Supabase creds were present and invalid (expected). Re-ran tests with Supabase env cleared and got all unit tests passing: 84/84.

Commit & Push
- Committed changes and pushed to main. Commit message included Co-authored-by: Copilot.
- Files staged included consolidated client, adapter, docs, and adjusted tests.

Operational notes & recommendations
- Confirm secret-key semantics in a live sandbox call with a real merchant reference (the test reference yields 404 and does not show auth differences). If the sandbox treats empty-secret differently from omitted, set DUSUPAY_INCLUDE_EMPTY_SECRET accordingly or adjust code to always omit empty headers.
- Verify Vercel / production environment variables do not override the sandbox host with the portal hostname. Update hosted envs if necessary.
- Keep adapter (lib/dusupay.ts) while migrating imports; consider removing adapter after all code/imports updated to import directly from lib/dusupay/client.ts.
- Reconciliation cron (app/api/cron/reconcile-dusupay/route.ts) uses the network-vs-api distinction: when DusupayNetworkError is thrown, mark advance as processing_unknown; when DusuPay confirms success but ledger RPC fails, mark disbursed_pending_ledger.

Files changed (not exhaustive)
- lib/dusupay/client.ts (new consolidated client; host default -> https://sandboxapi.dusupay.com)
- lib/dusupay.ts (adapter re-export)
- lib/dusupay/types.ts (used by client)
- app/api/cron/reconcile-dusupay/route.ts (reconciliation passes for processing_unknown & disbursed_pending_ledger)
- lib/services/payout-service.ts (advance state transitions updated to processing_unknown and disbursed_pending_ledger)
- app/api/dusupay/verify/route.ts updated to use new result shape
- docs/dusupay-sandbox-header-verification.md (how-to)
- docs/dusupay-consolidation-and-host-fix.md (this file)

How to reproduce locally (quick)
1. Ensure .env.local contains sandbox keys (DUSUPAY_PUBLIC_KEY, optionally DUSUPAY_SECRET_KEY) and optional DUSUPAY_SANDBOX_BASE_URL if overriding.
2. Run the curl checks in docs/dusupay-sandbox-header-verification.md to confirm host and header behavior.
3. Run npm run test:unit. If your .env.local includes Supabase keys, some integration tests may run — clear Supabase env vars for a pure unit pass.

Rollback
- Revert commit a8feedb on main if immediate rollback is needed. Because changes touch financial flow code, coordinate with ops before reverting and ensure reconciliation logic is considered.

Contact
- Dev who made changes: Copilot CLI (co-authored). For follow-ups, request targeted tasks: (1) run live merchant-reference checks, (2) update hosted envs, (3) remove adapter imports.

Document history
- Created: 2026-08-08 by Copilot CLI
- Related docs: docs/dusupay-sandbox-header-verification.md

