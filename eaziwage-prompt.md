# DusuPay Payment Integration Prompt for EaziWage

## Role
You are a senior full-stack engineer specializing in fintech payment integrations, with expertise in Next.js, TypeScript, PostgreSQL, and African mobile money payment systems. You have deep knowledge of secure API integration patterns, webhook handling, transaction state management, and PCI DSS compliance requirements for financial applications.

## Task
Integrate DusuPay payment gateway into the EaziWage earned wage access platform to enable secure mobile money and bank transfer disbursements across East Africa (Kenya, Uganda, Tanzania, Rwanda). The integration must handle wage advance payouts, webhook callbacks, transaction reconciliation, multi-currency support, and comprehensive error handling while maintaining high security and reliability standards for production financial transactions.

## Context

### System Architecture
EaziWage is a production fintech platform built with:
- **Stack**: Next.js 16, React 19, TypeScript, PostgreSQL (Drizzle ORM), Supabase Auth
- **Payment Flow**: Employee requests wage advance → Risk assessment → Approval → DusuPay disbursement → Webhook confirmation → Transaction reconciliation
- **Users**: Employees (wage access), Employers (approvals), Admins (oversight)
- **Scale**: Multi-tenant system handling real financial transactions across 4 countries

### DusuPay Integration Requirements

#### Payment Methods to Support
**Mobile Money**:
- Kenya: M-Pesa (Safaricom), Airtel Money
- Uganda: MTN Mobile Money, Airtel Money
- Tanzania: M-Pesa (Vodacom), Airtel Money, TigoPesa
- Rwanda: MTN Mobile Money, Airtel Money

**Bank Transfers**:
- All supported countries with local bank routing

#### Key DusuPay Endpoints
```
Base URLs:
- Sandbox: https://sandboxapi.dusupay.com/
- Production: https://payments.dusupay.com/

Core Endpoints:
- POST /payout/send-funds - Initiate disbursement
- GET /data/wallet-balances - Check available balance
- GET /data/payment-providers - Query payment options
- GET /data/payout-bank-codes - Get bank routing codes
- GET /data/transaction/verify/{reference} - Status verification
```

#### Authentication
- Headers: `public-key`, `secret-key`, `x-api-version: 1`
- Store keys securely in environment variables
- Separate keys for sandbox and production

#### Webhook Security
- **IP Whitelisting**: Production (161.35.164.139), Sandbox (165.227.128.244)
- **Signature Verification**: Both HMAC and RSA signatures provided
- **HMAC Format**: `t=timestamp,s=hash` 
- **Payload Format**: `event:merchant_reference:internal_reference:transaction_type:transaction_status`
- **Required Response**: HTTP 200 for acknowledgment

#### Transaction Workflow
1. **Payout Request**: EaziWage → DusuPay (HTTP 202 acknowledgment)
2. **Verification Callback**: DusuPay → EaziWage verification URL (respond HTTP 200 to approve)
3. **Final Status Webhook**: DusuPay → EaziWage notification URL (COMPLETED/FAILED)
4. **Reconciliation**: Update EaziWage transaction records

#### Callback Events
**Payouts**:
- `request.failed` - Request validation failed
- `transaction.failed` - Processing failed (e.g., insufficient balance)
- `transaction.completed` - Payout successful

#### Cross-Currency Support
- Request currency can differ from payout currency
- DusuPay handles automatic conversion at market rates
- Example: USD request → UGX payout (1 USD = 3,800 UGX)
- Merchant balance debited in transaction currency

#### Rate Limits & Constraints
- Status check: Minimum 2 minutes after initiation, 5-minute intervals recommended
- Transaction limits vary by payment provider and country
- Rolling reserve may apply to certain transaction types

### EaziWage Database Schema (Relevant Tables)

**transactions**
```typescript
{
  id: uuid (PK)
  advance_id: uuid (FK → advances.id)
  amount: decimal
  currency: string
  method: enum('mobile_money', 'bank_transfer')
  status: enum('pending', 'processing', 'completed', 'failed', 'cancelled')
  provider_reference: string (DusuPay internal_reference)
  merchant_reference: string (EaziWage unique reference)
  provider_status_message: string
  metadata: jsonb
  created_at, updated_at, completed_at: timestamp
}
```

**advances**
```typescript
{
  id: uuid (PK)
  employee_id: uuid (FK)
  organization_id: uuid (FK)
  amount: decimal
  currency: string
  status: enum('pending', 'approved', 'rejected', 'disbursed', 'failed')
  payment_method: jsonb { type, account_number, provider_code, bank_code }
  created_at, updated_at: timestamp
}
```

**employees**
```typescript
{
  id: uuid (PK)
  organization_id: uuid (FK)
  phone_number: string (E.164 format)
  payment_methods: jsonb[]
  kyc_status: enum('pending', 'verified', 'rejected')
}
```

**organizations**
```typescript
{
  id: uuid (PK)
  payout_settings: jsonb {
    dusupay_enabled: boolean
    verification_url: string
    notification_url: string
    auto_approve_under: decimal
  }
}
```

### Existing EaziWage Patterns

**API Route Structure**
```typescript
// app/api/v1/[resource]/route.ts
export async function POST(request: Request) {
  const session = await getServerSession();
  const body = await request.json();
  const validated = schema.parse(body);
  // Business logic
  return NextResponse.json(result);
}
```

**Error Handling**
```typescript
try {
  // Operation
} catch (error) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.errors }, { status: 400 });
  }
  logger.error('Operation failed', { error, context });
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}
```

**Database Transactions**
```typescript
await db.transaction(async (tx) => {
  await tx.update(advances).set({ status: 'disbursed' });
  await tx.insert(transactions).values({ ... });
});
```

## Constraints

### Security Requirements
1. **Authentication**: All DusuPay API calls must use environment-specific credentials
2. **Webhook Verification**: MUST verify HMAC or RSA signature on all callbacks
3. **IP Whitelisting**: MUST validate webhook source IP before processing
4. **Secret Management**: Store API keys in environment variables, never in code
5. **PII Protection**: Never log full phone numbers, account numbers, or API keys
6. **SQL Injection**: Use Supabase parameterized queries only
7. **Input Validation**: Validate all inputs with Zod schemas before processing

### Data Integrity Requirements
1. **Idempotency**: Use unique merchant_reference to prevent duplicate payouts
2. **Transaction State**: Maintain audit trail of all status changes with timestamps
3. **Reconciliation**: Match webhook callbacks to transactions using internal_reference
4. **Atomicity**: Use database transactions for multi-step operations
5. **Retry Logic**: Implement exponential backoff for failed API calls (max 3 retries)
6. **Status Consistency**: Ensure EaziWage and DusuPay transaction states stay synchronized

### Error Handling Requirements
1. **Failed Payouts**: Update advance status to 'failed', notify employee, log reason
2. **Webhook Failures**: Return HTTP 200 to DusuPay, queue for retry if processing fails
3. **Timeout Handling**: 30-second timeout on DusuPay API calls
4. **Balance Checks**: Verify sufficient DusuPay wallet balance before initiating payout
5. **Graceful Degradation**: If DusuPay unavailable, queue payouts for later processing
6. **User Notifications**: Send email/SMS on transaction status changes

### Performance Requirements
1. **Response Time**: Webhook endpoints must respond within 5 seconds
2. **Rate Limiting**: Respect DusuPay rate limits (status check intervals)
3. **Caching**: Cache payment provider lists and bank codes (refresh hourly)
4. **Async Processing**: Process webhooks asynchronously to avoid blocking
5. **Database Optimization**: Use indexes on merchant_reference and provider_reference

### Compliance Requirements
1. **Audit Trail**: Log all payout requests, webhook receipts, and status changes
2. **Data Retention**: Maintain transaction records per regulatory requirements
3. **PCI DSS**: No storage of sensitive payment credentials
4. **Cross-Border**: Handle multi-currency compliance and reporting
5. **KYC Verification**: Only disburse to KYC-verified employees

### Code Quality Requirements
1. **TypeScript**: Strict mode, no `any` types
2. **Testing**: Unit tests for all business logic, integration tests for API routes
3. **Documentation**: JSDoc comments on all exported functions
4. **Error Messages**: User-friendly messages for UI, detailed logs for debugging
5. **Code Review**: All payment logic requires security review before merge

### Specific Implementation Requirements

#### File Structure
```
app/
  api/
    v1/
      payouts/
        initiate/route.ts          # Initiate DusuPay payout
        verify/route.ts            # Verification callback endpoint
        webhook/route.ts           # Final status webhook endpoint
        status/[id]/route.ts       # Manual status check
      dusupay/
        balance/route.ts           # Check wallet balance
        providers/route.ts         # Get payment options
lib/
  dusupay/
    client.ts                      # DusuPay API client
    webhooks.ts                    # Signature verification
    types.ts                       # TypeScript types
    utils.ts                       # Helper functions
  services/
    payout-service.ts              # Business logic
    transaction-service.ts         # Transaction state management
```

#### Required Environment Variables
```env
# DusuPay Sandbox
DUSUPAY_SANDBOX_PUBLIC_KEY=
DUSUPAY_SANDBOX_SECRET_KEY=
DUSUPAY_SANDBOX_SIGNING_KEY=
DUSUPAY_SANDBOX_BASE_URL=https://sandboxapi.dusupay.com

# DusuPay Production
DUSUPAY_PRODUCTION_PUBLIC_KEY=
DUSUPAY_PRODUCTION_SECRET_KEY=
DUSUPAY_PRODUCTION_SIGNING_KEY=
DUSUPAY_PRODUCTION_BASE_URL=https://payments.dusupay.com

# Configuration
DUSUPAY_ENVIRONMENT=sandbox|production
DUSUPAY_WEBHOOK_VERIFICATION_URL=https://yourdomain.com/api/v1/payouts/verify
DUSUPAY_WEBHOOK_NOTIFICATION_URL=https://yourdomain.com/api/v1/payouts/webhook
```

#### Payout Request Format
```typescript
{
  merchant_reference: string;        // EaziWage unique ID (e.g., ADV-{advance_id})
  transaction_method: "MOBILE_MONEY" | "BANK";
  currency: "KES" | "UGX" | "TZS" | "RWF";
  amount: number;
  provider_code: string;             // From payment options API
  account_number: string;            // Phone (E.164) or bank account
  customer_name: string;
  description: string;               // 10-30 chars
  bank_code?: string;                // Required for bank transfers
}
```

#### Webhook Payload Structure
```typescript
{
  event: "transaction.completed" | "transaction.failed" | "request.failed";
  payload: {
    id: number;
    merchant_reference: string;
    internal_reference: string;      // DusuPay reference
    transaction_type: "PAYOUT";
    request_currency: string;
    transaction_amount: number;
    transaction_currency: string;
    transaction_charge: number;
    transaction_account: string;
    total_debit: number;
    provider_code: string;
    customer_name: string;
    transaction_status: "COMPLETED" | "FAILED";
    status_message: string;
  }
}
```

### Implementation Priorities
1. **Phase 1 (Critical)**: Payout initiation, webhook handling, HMAC verification
2. **Phase 2 (Important)**: Balance checks, provider queries, status verification
3. **Phase 3 (Enhancement)**: Caching, retry mechanisms, admin dashboard

### Testing Requirements
1. **Sandbox Testing**: Test all payment methods in sandbox before production
2. **Test Cases**: Success, insufficient balance, invalid account, network timeout
3. **Webhook Testing**: Verify signature validation, idempotency, error handling
4. **Integration Tests**: End-to-end flow from advance approval to disbursement
5. **Test Phone Numbers**: Use DusuPay sandbox test accounts (documented in API)

### Monitoring & Alerting
1. **Success Rate**: Alert if payout success rate drops below 95%
2. **Failed Webhooks**: Alert on repeated webhook processing failures
3. **Balance Monitoring**: Alert when DusuPay wallet balance < threshold
4. **Transaction Delays**: Alert if transactions stuck in 'processing' > 30 minutes
5. **Error Tracking**: Log all DusuPay API errors with full context

### Documentation Requirements
1. **README**: Setup instructions, environment variables, testing guide
2. **API Docs**: Endpoint specifications, request/response examples
3. **Runbook**: Production troubleshooting, common issues, escalation procedures
4. **Architecture Diagram**: Payment flow visualization
5. **Code Comments**: Complex business logic, security considerations

## Expected Deliverables

1. **DusuPay Client Library** (`lib/dusupay/client.ts`)
   - Type-safe API wrapper for all DusuPay endpoints
   - Automatic environment selection (sandbox/production)
   - Built-in retry logic and timeout handling
   - Comprehensive error handling

2. **Webhook Handler** (`lib/dusupay/webhooks.ts`)
   - HMAC signature verification
   - RSA signature verification (alternative)
   - IP whitelist validation
   - Webhook payload parsing and validation

3. **API Routes**
   - `POST /api/v1/payouts/initiate` - Initiate payout
   - `GET /api/v1/payouts/verify` - Verification callback
   - `POST /api/v1/payouts/webhook` - Status webhook
   - `GET /api/v1/payouts/status/[id]` - Manual status check
   - `GET /api/v1/dusupay/balance` - Wallet balance
   - `GET /api/v1/dusupay/providers` - Payment options

4. **Service Layer** (`lib/services/payout-service.ts`)
   - Business logic for payout initiation
   - Transaction state management
   - Reconciliation logic
   - Error recovery procedures

5. **Database Migrations**
   - Add DusuPay-specific fields to transactions table
   - Add indexes for performance
   - Add audit tables if needed

6. **Type Definitions** (`lib/dusupay/types.ts`)
   - DusuPay API request/response types
   - Webhook payload types
   - Database model types

7. **Tests**
   - Unit tests for all utility functions
   - Integration tests for API routes
   - Webhook signature verification tests
   - End-to-end payout flow tests

8. **Documentation**
   - Integration setup guide
   - Environment variable configuration
   - Testing procedures
   - Troubleshooting guide

## Success Criteria

1. **Functional**: Successfully disburse wage advances via DusuPay to all supported countries/methods
2. **Reliable**: 99.5%+ webhook processing success rate
3. **Secure**: All webhooks verified, no security vulnerabilities
4. **Performance**: Webhook endpoints respond within 5 seconds
5. **Maintainable**: Code is well-documented, tested, and follows EaziWage patterns
6. **Compliant**: Meets all audit trail and regulatory requirements
7. **Observable**: Comprehensive logging and monitoring in place

## Reference Materials

- DusuPay API Documentation: https://developer.dusupay.com/
- DusuPay Postman Collection: https://postman.dusupay.com
- EaziWage System Prompt: [Provided in context]
- DusuPay Integration Guide: DusupPay_API_Documentation.docx

## Additional Notes

### Phone Number Formatting
- All phone numbers must be in E.164 format (e.g., 254712345678 for Kenya)
- Strip leading zeros and country codes from user input
- Validate against DusuPay provider prefixes before submission

### Currency Handling
- Store all amounts as decimals with 2 decimal places
- Handle cross-currency conversion gracefully
- Display transaction amounts in both request and transaction currencies

### Transaction Reference Generation
```typescript
// Format: ADV-{advance_id}-{timestamp}
const merchantReference = `ADV-${advanceId}-${Date.now()}`;
```

### Webhook Retry Strategy
- DusuPay retries with exponential backoff if webhook fails
- EaziWage must return HTTP 200 even if internal processing fails
- Queue failed webhook processing for retry internally

### Production Deployment Checklist
1. Verify production API keys configured
2. Update webhook URLs to production endpoints
3. Whitelist DusuPay production IP (161.35.164.139)
4. Test with small amounts first
5. Monitor closely for 24 hours post-deployment
6. Have rollback plan ready

### Common Edge Cases to Handle
1. Employee changes payment method after advance approved
2. DusuPay wallet insufficient balance
3. Invalid/dormant mobile money account
4. Network timeout during payout initiation
5. Duplicate webhook delivery
6. Webhook arrives before initial API response
7. Cross-currency rate fluctuation between request and completion
8. Employee account suspended after payout initiated

---

**Remember**: This is a production financial system handling real money. Prioritize security, reliability, and data integrity above all else. When in doubt, fail safely and alert appropriately.