/**
 * Unit tests for the advance request Zod schema.
 * Mirrors requestSchema from app/api/employee-dashboard/request-advance/route.ts.
 * These run without a server so they are always fast and always reliable.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const requestSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  disbursement_method: z.enum(['mobile_money', 'bank_transfer']),
  payment_method_id: z.string().optional().nullable(),
});

describe('advance request schema', () => {
  describe('amount', () => {
    it('accepts a positive integer amount', () => {
      expect(requestSchema.safeParse({ amount: 5000, disbursement_method: 'mobile_money' }).success).toBe(true);
    });

    it('accepts a positive decimal amount', () => {
      expect(requestSchema.safeParse({ amount: 1500.50, disbursement_method: 'mobile_money' }).success).toBe(true);
    });

    it('rejects zero amount', () => {
      const r = requestSchema.safeParse({ amount: 0, disbursement_method: 'mobile_money' });
      expect(r.success).toBe(false);
    });

    it('rejects negative amount', () => {
      const r = requestSchema.safeParse({ amount: -500, disbursement_method: 'mobile_money' });
      expect(r.success).toBe(false);
    });

    it('rejects string amount', () => {
      const r = requestSchema.safeParse({ amount: '5000', disbursement_method: 'mobile_money' });
      expect(r.success).toBe(false);
    });

    it('rejects missing amount', () => {
      const r = requestSchema.safeParse({ disbursement_method: 'mobile_money' });
      expect(r.success).toBe(false);
    });
  });

  describe('disbursement_method', () => {
    it('accepts mobile_money', () => {
      expect(requestSchema.safeParse({ amount: 1000, disbursement_method: 'mobile_money' }).success).toBe(true);
    });

    it('accepts bank_transfer', () => {
      expect(requestSchema.safeParse({ amount: 1000, disbursement_method: 'bank_transfer' }).success).toBe(true);
    });

    it('rejects unknown method', () => {
      const r = requestSchema.safeParse({ amount: 1000, disbursement_method: 'cash' });
      expect(r.success).toBe(false);
    });

    it('rejects missing disbursement_method', () => {
      const r = requestSchema.safeParse({ amount: 1000 });
      expect(r.success).toBe(false);
    });

    it('rejects disbursement_method with wrong casing', () => {
      const r = requestSchema.safeParse({ amount: 1000, disbursement_method: 'Mobile_Money' });
      expect(r.success).toBe(false);
    });
  });

  describe('payment_method_id', () => {
    it('is optional — omitting it is valid', () => {
      expect(requestSchema.safeParse({ amount: 1000, disbursement_method: 'mobile_money' }).success).toBe(true);
    });

    it('accepts a string payment_method_id', () => {
      const r = requestSchema.safeParse({ amount: 1000, disbursement_method: 'mobile_money', payment_method_id: 'pm-abc-123' });
      expect(r.success).toBe(true);
    });

    it('accepts explicit null', () => {
      const r = requestSchema.safeParse({ amount: 1000, disbursement_method: 'mobile_money', payment_method_id: null });
      expect(r.success).toBe(true);
    });

    it('rejects a numeric payment_method_id', () => {
      const r = requestSchema.safeParse({ amount: 1000, disbursement_method: 'mobile_money', payment_method_id: 42 });
      expect(r.success).toBe(false);
    });
  });
});
