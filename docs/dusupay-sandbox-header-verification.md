DusuPay Sandbox Header Verification

Purpose
- Confirm DusuPay sandbox accepts absent vs empty `secret-key` header and document test steps.

Safety
- Use sandbox credentials only. Do not commit secrets. Run tests from a secure machine.

Steps
1. Check base host (should be https://sandboxapi.dusupay.com):
   curl -sS "https://sandboxapi.dusupay.com/data/payment-providers?currency=KES&transaction_type=payout" | head -c 300

2. Test request WITHOUT secret-key header (unset):
   curl -sS -H "public-key: $DUSUPAY_PUBLIC_KEY" \
        "https://sandboxapi.dusupay.com/data/transaction/verify/TEST-REF" -v

3. Test request WITH empty secret-key header:
   curl -sS -H "public-key: $DUSUPAY_PUBLIC_KEY" -H "secret-key:" \
        "https://sandboxapi.dusupay.com/data/transaction/verify/TEST-REF" -v

4. Test request WITH secret-key value:
   curl -sS -H "public-key: $DUSUPAY_PUBLIC_KEY" -H "secret-key: $DUSUPAY_SECRET_KEY" \
        "https://sandboxapi.dusupay.com/data/transaction/verify/TEST-REF" -v

Expected
- API host must return JSON (code 200 & JSON body) for provider list.
- Verify whether responses differ when secret-key is omitted vs empty vs present (status code / error message).

Record findings
- Note HTTP status, body sample, and whether the request succeeded or returned an authentication error.
- If sandbox treats empty header differently, set DUSUPAY_INCLUDE_EMPTY_SECRET accordingly or update code to always omit empty header.

Notes
- Do not run against production endpoints. If CI automation is desired, implement small integration test with sandbox creds and mark it skipped when creds are absent.

Authored: Copilot CLI on 2026-08-08
