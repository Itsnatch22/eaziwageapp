# Smoke Tests — Reconcile DusuPay Watchdog

This document describes the smoke tests for the automatic reservation release feature in the reconcile-dusupay cron job.

## Overview

Two test files have been added:

1. **`tests/cron-watchdog.spec.ts`** — Playwright end-to-end test
   - Tests the HTTP endpoint directly
   - Verifies authentication (cron auth header)
   - Checks that the endpoint is callable and returns the expected response shape

2. **`tests/unit/cron-watchdog.test.ts`** — Vitest integration test
   - Sets up test data (employer, employee, advance in 'processing')
   - Verifies the watchdog can detect stuck advances
   - Tests the RPC `release_employer_reservation` is callable
   - Provides a schema smoke test

## Requirements

To run these tests, ensure the following environment variables are set:

### For Playwright tests (HTTP endpoint):
```bash
CRON_SECRET=<your-cron-secret>
```

### For Vitest integration tests (database):
```bash
NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
CRON_SECRET=<your-cron-secret>
```

## Running the Tests

### Playwright smoke test only
```bash
npm run test:e2e -- tests/cron-watchdog.spec.ts
```

Or run a single test by name:
```bash
npx playwright test tests/cron-watchdog.spec.ts -g "endpoint accepts valid cron auth"
```

### Vitest integration tests only
```bash
npm run test:unit -- tests/unit/cron-watchdog.test.ts
```

Or with watch mode:
```bash
npm run test:unit:watch -- tests/unit/cron-watchdog.test.ts
```

### All tests (Playwright + Vitest)
```bash
npm run test:unit && npm run test:e2e
```

## What the Tests Verify

### 1. Endpoint Authentication (Playwright)
- Unsigned requests are rejected with 401
- Malformed auth headers are rejected with 401
- Properly-signed requests with valid CRON_SECRET are accepted with 200

### 2. Endpoint Behavior (Playwright)
- The endpoint returns a JSON body with the expected fields:
  - `checked`, `mismatches`, `stuckProcessing`
  - `advances`, `walletTopups`, `watchdog` (each with subfields)
- The watchdog field includes: `checked`, `resolved`, `stuck` (count of unresolved advances)

### 3. Data Setup & RPC (Vitest)
- Can connect to Supabase and query the schema
- Can create test data (advance in 'processing' status, stuck for >15 min)
- Can call `release_employer_reservation` RPC without error

## Manual Smoke Test

To manually verify the watchdog works in your environment:

```bash
# Start the dev server (in one terminal)
npm run dev

# In another terminal, make a request to the cron endpoint
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reconcile-dusupay

# Expected response (200 OK, JSON body):
{
  "checked": 0,
  "total": 0,
  "mismatches": 0,
  "stuckProcessing": 0,
  "advances": { "checked": 0, "total": 0, "mismatches": 0 },
  "walletTopups": { "checked": 0, "mismatches": 0 },
  "watchdog": { "checked": 0, "resolved": 0, "stuck": 0 }
}
```

If there are stuck advances in the database that match DusuPay's status as 'failed', the watchdog will mark them failed and attempt the reservation release.

## Full End-to-End Test Scenario

To test the full reservation release flow:

1. Create a test advance manually or via test data setup
2. Set its status to 'processing' and updated_at to >15 min ago
3. Ensure DusuPay has the advance's reference and will return 'FAILED' status
4. Run the watchdog: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reconcile-dusupay`
5. Verify:
   - The advance's status changed from 'processing' to 'failed'
   - Check the server logs for `[reconcile-dusupay] release_employer_reservation RPC` entries
   - If the RPC succeeded: logs show no error
   - If the RPC failed: advance remains in unresolvedStuck and is alerted
6. Manually verify the employer's wallet reservation was released (check wallet balance)

## Debugging

### If tests are skipped:
Check that all required environment variables are set. Tests gracefully skip when env vars are missing to avoid false CI failures.

### If tests fail with 401 Unauthorized:
- Verify CRON_SECRET matches the value expected by `isValidCronAuth()` in `lib/cron-auth.ts`
- Auth header format must be exactly: `Bearer ${CRON_SECRET}`

### If Vitest integration tests fail to create test data:
- Verify Supabase credentials are correct
- Check that the target database has the expected schema (advances, employees, employers tables)
- Look for constraint errors in the logs (e.g., missing foreign key references)

### If the RPC call fails in the integration test:
- Check that `release_employer_reservation` RPC exists in your Supabase project
- Verify the RPC's parameter names match: `p_employer_id`, `p_amount`, `p_advance_id`
- If the RPC doesn't exist, deploy the Supabase migration that creates it

## Related Code

- Watchdog logic: `app/api/cron/reconcile-dusupay/route.ts`
- RPC definition: Look in `supabase/migrations/` or call `supabase-mcp list_edge_functions`
- Reservation release pattern: Used in `lib/services/advance-approval.ts`, `lib/services/payout-service.ts`

## Notes on Money-Adjacent Changes

The automatic reservation release is a **critical financial operation**:
- It directly affects employer wallet balance
- A failed release leaves funds permanently locked
- Errors are logged and the advance remains unresolved (safe fail)

**Before deploying to production:**
1. Run these smoke tests in staging
2. Create a real test advance and verify the watchdog releases it correctly
3. Confirm the employer's wallet balance is updated
4. Review the logs for any RPC errors or warnings
