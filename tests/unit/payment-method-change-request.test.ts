import { describe, expect, it } from 'vitest';
import { EmployeePaymentMethodChangeRequestSchema } from '@/lib/validations/route-schemas';

describe('EmployeePaymentMethodChangeRequestSchema', () => {
  it('accepts a valid mobile money change request', () => {
    const result = EmployeePaymentMethodChangeRequestSchema.safeParse({
      method_id: 'method-123',
      method_type: 'mobile_money',
      new_provider_name: 'M-PESA',
      new_phone_number: '0712345678',
      new_account_name: 'Jane Doe',
      reason: 'My number changed',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.new_phone_number).toBe('0712345678');
    }
  });

  it('requires an account number for bank account changes', () => {
    const result = EmployeePaymentMethodChangeRequestSchema.safeParse({
      method_id: 'method-123',
      method_type: 'bank_account',
      new_provider_name: 'KCB',
      new_account_name: 'Jane Doe',
      reason: 'Need to update account',
    });

    expect(result.success).toBe(false);
  });
});
