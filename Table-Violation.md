Based on my comprehensive audit of all API routes in `app/api/`, here is the structured report:

---

## CRITICAL — Data integrity broken

### 1. payout-service.ts - Rule 9 (Highest Priority)
```
File: lib/services/payout-service.ts
Route: disburseAdvance method
Rule violated: Rule 9
Issue: Disbursement reads payment details from employee_onboarding instead of payment_methods
Wrong: employee_onboarding!employee_id (mobile_money_number, mobile_money_provider, bank_account, bank_name) at lines 101-117
Correct: Read from payment_methods WHERE employee_id = (SELECT employee_id FROM advances) AND is_verified = true AND is_default = true
```

### 2. employer-dashboard/wallet/route.ts - Rule 4 & Rule 8
```
File: app/api/employer-dashboard/wallet/route.ts
Route: GET/POST
Rule violated: Rule 4, Rule 8
Issue: employer_wallets queried/created with onboarding_id instead of live employers.id
Wrong: .eq('employer_id', employer.onboarding_id) at lines 75, 88, 156, 166
Correct: Resolve employers.id from user_id and use that as employer_id in employer_wallets
```

### 3. advances/[id]/route.ts - Rule 8
```
File: app/api/advances/[id]/route.ts
Route: PATCH
Rule violated: Rule 8
Issue: Profiles table queried with wrong assumption about employee_id format
Wrong: supabase.from('profiles').select('salary, organization_id').eq('id', advance.employee_id) at line 68
Correct: employee_id in advances references employees.id, not user_id; join with employees table first
```

### 4. employee-dashboard/request-advance/route.ts - Rule 2
```
File: app/api/employee-dashboard/request-advance/route.ts
Route: POST
Rule violated: Rule 2
Issue: employee_ewa_settings queried using non-existent employee_onboarding_id column
Wrong: .eq('employee_onboarding_id', employee.id) at line 135 - employee.id is from employee_onboarding
Correct: Query with employeeId (resolved from employees table) using .eq('employee_id', employeeId)
```

### 5. employee-dashboard/request-advance/route.ts - Rule 8
```
File: app/api/employee-dashboard/request-advance/route.ts
Route: POST
Rule violated: Rule 8
Issue: advances.employer_id populated with onboarding employer_id instead of live employers.id
Wrong: employer_id: employee.employer_id (from employee_onboarding) at line 304
Correct: Resolve employers.id via employee.employer_id -> employers lookup
```

### 6. admin/settings/employees/[id]/route.ts - Rule 2
```
File: app/api/admin/settings/employees/[id]/route.ts
Route: PUT
Rule violated: Rule 2
Issue: Query uses employee_onboarding_id column that should be employee_id
Wrong: .eq('employee_onboarding_id', id) at lines 145, 147
Correct: .eq('employee_id', id) - the FK must point to employees.id
```

### 7. employee-dashboard/overview/route.ts - Rule 2 & Rule 5
```
File: app/api/employee-dashboard/overview/route.ts
Route: GET
Rule violated: Rule 2, Rule 5
Issue: employee_ewa_settings queried with employee_onboarding_id; advances queried with wrong employee ID
Wrong: .eq('employee_onboarding_id', employee.id) at line 112; .eq('employee_id', employee.id) at line 93
Correct: All employee_id FKs must reference employees.id, not employee_onboarding.id
```

### 8. employee-dashboard/employment/route.ts - Rule 2
```
File: app/api/employee-dashboard/employment/route.ts
Route: GET
Rule violated: Rule 2
Issue: employee_ewa_settings queried with employee_onboarding_id column
Wrong: .eq('employee_onboarding_id', onboarding.id) at lines 83, 132
Correct: Should query with employees.id after resolving employee record
```

---

## HIGH — Silent failures or security gaps

### 9. employer-dashboard/payroll/upload/route.ts - Rule 4
```
File: app/api/employer-dashboard/payroll/upload/route.ts
Route: POST
Rule violated: Rule 4
Issue: payroll_uploads.employer_id uses onboarding_id instead of live employers.id
Wrong: employer_id: employer.onboarding_id at line 47
Correct: Use employers.id (live table ID) for consistent FK relationships
```

### 10. employer-dashboard/payroll/sync/route.ts - Rule 8
```
File: app/api/employer-dashboard/payroll/sync/route.ts
Route: POST
Rule violated: Rule 8
Issue: payroll_integrations queried with onboarding_id instead of live employers.id
Wrong: .eq('employer_id', onboarding_id) at lines 107, 133
Correct: Resolve live employers.id and use consistently
```

### 11. employer-dashboard/payroll/connect/route.ts - Rule 8
```
File: app/api/employer-dashboard/payroll/connect/route.ts
Route: GET/POST/DELETE
Rule violated: Rule 8
Issue: payroll_integrations.employer_id uses onboarding_id instead of employers.id
Wrong: .eq('employer_id', employer.onboarding_id) at lines 60, 123, 236
Correct: Use employers.id for FK consistency
```

---

## MEDIUM — Structural concerns

### 12. employee-dashboard/onboarding/route.ts - Rule 6
```
File: app/api/employee-dashboard/onboarding/route.ts
Route: POST
Rule violated: Rule 6
Issue: Payment fields (mobile_money_number, bank_account) stored in employee_onboarding instead of payment_methods
Wrong: Lines 170-171, 214-218 store payment details in onboarding table
Correct: Newly approved employees should have payment methods in payment_methods table only
```

### 13. employer-dashboard/payroll/history/route.ts - Rule 4
```
File: app/api/employer-dashboard/payroll/history/route.ts
Route: GET
Rule violated: Rule 4
Issue: payroll_uploads.employer_id uses onboarding_id
Wrong: .eq('employer_id', employer.onboarding_id) at line 45
Correct: Consider migrating to employers.id for FK consistency
```

---

## CLEAN — Correctly following dual-table pattern

| File | Notes |
|------|-------|
| `app/api/admin/employees/[id]\kyc\route.ts` | Correctly uses supabaseAdmin, updates employee_onboarding for KYC status (intentional) |
| `app/api/admin/employers/[id]\status\route.ts` | Correctly syncs between employer_onboarding and employers tables |
| `app/api/admin/settings/employers/[id]\route.ts` | Correctly uses supabaseAdmin for admin operations |
| `app/api/admin/settings/employees/[id]\route.ts` (GET) | Correctly queries employees and employee_ewa_settings |
| `app/api/admin/payouts/fund-employer\route.ts` | Correctly uses supabaseAdmin RPC for financial operations |
| `app/api/admin/wallet/topup-requests\[id]\approve\route.ts` | Correctly uses supabaseAdmin for admin financial operations |
| `app/api/admin/dashboard\route.ts` | Correctly uses supabaseAdmin for admin stats |
| `app/api/auth/register\route.ts` | Correctly creates onboarding records during registration flow |
| `app/api/employee-dashboard/payment-methods\route.ts` | Correctly resolves employees.id and uses payment_methods table |
| `app/api/employee-dashboard/profile\route.ts` | Correctly merges live employee data with onboarding data |
| `app/api/employee-dashboard/transactions\route.ts` | Correctly resolves employees.id for advances query |
| `app/api/auth/session-login.ts` | Uses auth.admin.getUserById for session creation (auth context, not data display) |
| `app/api/webhook/dusupay\route.ts` | Correctly uses supabaseAdmin, resolves wallet via FK |
| `app/api/v1/payouts/webhook\route.ts` | Correctly uses supabaseAdmin for webhook handling |
| `app/api/admin/finances/stanbic-deposit\route.ts` | Correctly uses supabaseAdmin RPC for admin operations |
| `app/api/admin/review-requests\[id]\route.ts` | Correctly handles various review request types |

---

## Summary

**Critical Issues Found: 8**
- Rule 9 (payout-service.ts reading employee_onboarding) is the highest priority - disbursements will fail for approved employees
- Multiple routes use `onboarding_id` as FK in places where live `employers.id` or `employees.id` should be used
- Several routes query `employee_ewa_settings` using `employee_onboarding_id` instead of `employee_id`

**High Severity Issues Found: 3**
- Payroll uploads/sync/connect routes use onboarding IDs for employer relationships

**Medium Severity Issues Found: 2**
- Payment data fragmentation between onboarding and payment_methods tables