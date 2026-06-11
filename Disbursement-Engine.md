We are building a multi-country Earned Wage Access (EWA) platform called EaziWage.

Countries:
- Kenya (KE)
- Uganda (UG)
- Tanzania (TZ)
- Rwanda (RW)

Current problem:

Employees can request salary advances from the employee dashboard, but there is no disbursement destination model.

Design and implement a complete payout destination architecture for salary advance disbursements.

Requirements:

1. Payment Methods

Create a payment_methods table linked to employees.

Fields:

- id
- employee_id
- country_code
- method_type
- provider_name
- account_name
- account_number
- phone_number
- is_default
- is_verified
- created_at
- updated_at

Supported method types:

- mobile_money
- bank_account

2. Country-specific providers

Kenya:
- M-PESA
- Airtel Money
- Employee's bank of choice (listed in the onboarding page)

Uganda:
- MTN Mobile Money
- Airtel Money
- Employee's bank of choice (listed in the onboarding page)

Tanzania:
- M-Pesa Tanzania
- Airtel Money
- Tigo Pesa
- Employee's bank of choice (listed in the onboarding page)

Rwanda:
- MTN MoMo
- Airtel Money
- Employee's bank of choice (listed in the onboarding page)

Store providers in a configurable structure rather than hardcoded business logic.

3. Employee Payment Methods Page

Enhance the existing payment-methods section.

Employees must be able to:

- Add payment methods
- Edit payment methods
- Remove payment methods
- Set a default payment method
- View verification status

Validation:

- Only one default method per employee
- Phone numbers validated according to country
- Bank accounts validated before save where possible

4. Advance Request Flow

Before submitting an advance request:

Employee selects:

- Amount
- Disbursement destination

Example:

Amount: 500 KES

Send To:
(x) M-PESA - 0712345678
( ) Equity Bank - XXXX1234

Request payload must include:

{
  amount,
  payment_method_id
}

Do not allow advance requests if:

- no verified payment method exists
- no default payment method exists
- employee KYC is incomplete

5. Backend Validation

On advance creation:

- Validate employee ownership of payment method
- Validate payment method is active
- Validate payment method is verified
- Validate payment method country matches employee country

Reject invalid requests.

6. Advance Lifecycle

Statuses:

- pending
- approved
- disbursing
- disbursed
- failed
- repaid

Create audit trail records for every status change.

7. Future Integration Readiness

Do not directly integrate payment providers yet.

Instead create an abstraction:

PayoutProvider

Methods:

- validateDestination()
- initiateTransfer()
- getTransferStatus()

Create country/provider adapters for future implementation.

Example:

MpesaProvider
AirtelMoneyProvider
BankTransferProvider

Use dependency injection and clean architecture.

8. Dashboard Visibility

Employee dashboard:

- selected payout destination
- disbursement status
- transfer reference

Employer dashboard:

- payout destination used
- advance status
- repayment tracking

Admin dashboard:

- country distribution
- payout provider statistics
- failed disbursements
- reconciliation support

Generate:
- database schema
- Supabase migrations
- TypeScript types
- API routes
- validation schemas
- service layer
- React components
- security checks
- audit logging

Follow existing project conventions and folder structure.