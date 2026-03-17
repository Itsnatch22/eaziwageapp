# EaziWage DusuPay Integration: Final Phase Documentation

This document provides a comprehensive overview of the refactored DusuPay integration and the complete financial workflow implemented for EaziWage.

## 1. End-to-End Workflow

The system manages the entire lifecycle of a wage advance, from the initial request to final disbursement and repayment.

### Step 1: Employee Request
- **Action**: Employee visits the **Request Advance** page.
- **Process**: 
    - The system calculates a **Platform Fee** based on the employer's risk score using `calculateFeePercentage`.
    - The employee sees the **Gross Amount**, **Fee**, and **Net Disbursement**.
    - The request is saved to the `advances` table with a `pending` status.
- **Payment Details**: The system automatically utilizes the **Mobile Money** or **Bank Account** details provided during the employee's onboarding process (`employee_onboarding` table).

### Step 2: Employer Review & Approval
- **Action**: Employer sees the request in their **Advances** dashboard.
- **Process**:
    - Upon clicking **Approve**, the system calls `payoutService.reserveFunds`.
    - This creates a `pending` transaction in the employer's virtual wallet, "locking" the funds.
    - If the employer has insufficient balance or outstanding arrears, the approval is blocked.

### Step 3: Admin Oversight & Disbursement
- **Action**: Admins track all requests in the **Admin Advances** page.
- **Process**:
    - Admins can view `pending`, `approved`, `processing`, `completed`, and `failed` advances.
    - For `approved` advances, the admin (or a system trigger) initiates `payoutService.disburseAdvance`.
    - The service fetches the employee's specific onboarding details (e.g., M-Pesa number or Bank account) and sends the payout request to **DusuPay**.

### Step 4: DusuPay Verification & Webhook
- **Verification**: DusuPay calls our `/api/v1/payouts/verify` endpoint. We confirm the transaction is legitimate and return `200 OK`.
- **Final Status**: DusuPay sends a signed webhook to `/api/v1/payouts/webhook`.
    - **Success**: The `advances` status moves to `completed`, and the employer's "reserved" wallet transaction is finalized.
    - **Failure**: The status moves to `failed`, and the reserved funds are released back to the employer.

## 2. Financial Architecture (The Three-Tier Wallet)

1.  **Admin Wallet (Main Stanbic Source)**: 
    - The platform's primary liquidity pool, funded via Stanbic Bank.
2.  **Employer Wallet**: 
    - Tracks internal credit/balance. Funded by the Admin Wallet.
3.  **DusuPay Wallet Mirror**:
    - Reflects real-time balances at the DusuPay gateway.

## 3. Key Implementation Files

- **`lib/dusupay/client.ts`**: Core API wrapper for DusuPay.
- **`lib/services/payout-service.ts`**: Centralized service for fund movement and disbursement.
- **`app/api/v1/payouts/`**: Webhook and Verification endpoints.
- **`app/admin/advances/page.tsx`**: Admin tracking dashboard.
- **`supabase/admin_finances.sql`**: Database schema for the virtual wallet system.

## 4. Security & Integrity
- **Idempotency**: Every payout uses a unique `merchant_reference` to prevent duplicate payments.
- **Signature Verification**: Webhooks are verified using HMAC-SHA256 signatures.
- **Atomic Transactions**: All fund movements are handled via PostgreSQL RPC functions to ensure data consistency.
