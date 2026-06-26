import { describe, it, expect } from 'vitest';
import { calculateFeePercentage } from '@/lib/utils';

// Replicates the integer-cent arithmetic used in request-advance/route.ts
function computeAdvanceFee(requestedAmount: number, riskScore: number) {
  const feePct       = Math.round(calculateFeePercentage(riskScore) * 100); // centi-percent, integer
  const amountMinor  = Math.round(requestedAmount * 100);                    // integer cents
  const feeMinor     = Math.round(amountMinor * feePct / 10000);            // integer cents
  const netMinor     = amountMinor - feeMinor;
  return {
    feePercentage: feePct / 100,
    feeAmount:     feeMinor / 100,
    netAmount:     netMinor / 100,
  };
}

describe('calculateFeePercentage', () => {
  // fee = baseFee(3.5) + riskAdjustment(3.0) * (1 - riskScore / 5)

  it('returns 6.5% for risk score 0 (maximum fee)', () => {
    expect(calculateFeePercentage(0)).toBe(6.5);
  });

  it('returns 3.5% for risk score 5 (base fee, no risk premium)', () => {
    expect(calculateFeePercentage(5)).toBe(3.5);
  });

  it('returns 5.0% at midpoint risk score 2.5', () => {
    expect(calculateFeePercentage(2.5)).toBe(5.0);
  });

  it('returns ~4.7% for default risk score of 3', () => {
    // 3.5 + 3.0 * (1 - 3/5) = 3.5 + 1.2 = 4.7
    expect(calculateFeePercentage(3)).toBeCloseTo(4.7, 10);
  });

  it('returns ~3.8% for low-risk score of 4.5', () => {
    // 3.5 + 3.0 * (1 - 4.5/5) = 3.5 + 0.3 = 3.8
    expect(calculateFeePercentage(4.5)).toBeCloseTo(3.8, 10);
  });
});

describe('advance fee arithmetic — integer-cent precision', () => {
  it('fee + net exactly equals gross for round amounts', () => {
    const { feeAmount, netAmount } = computeAdvanceFee(10000, 3);
    expect(feeAmount + netAmount).toBe(10000);
  });

  it('fee + net exactly equals gross for irregular amounts (float trap)', () => {
    // 0.1 + 0.2 === 0.30000000000000004 in floats — integer arithmetic avoids this
    const { feeAmount, netAmount } = computeAdvanceFee(33.33, 3);
    expect(Number((feeAmount + netAmount).toFixed(2))).toBe(33.33);
  });

  it('KES 5000 advance at risk 3 → fee 235, net 4765', () => {
    // 4.7% of 5000 = 235 exactly
    const result = computeAdvanceFee(5000, 3);
    expect(result.feeAmount).toBe(235);
    expect(result.netAmount).toBe(4765);
  });

  it('KES 10000 advance at risk 0 (max fee 6.5%) → fee 650, net 9350', () => {
    const result = computeAdvanceFee(10000, 0);
    expect(result.feeAmount).toBe(650);
    expect(result.netAmount).toBe(9350);
  });

  it('KES 10000 advance at risk 5 (min fee 3.5%) → fee 350, net 9650', () => {
    const result = computeAdvanceFee(10000, 5);
    expect(result.feeAmount).toBe(350);
    expect(result.netAmount).toBe(9650);
  });

  it('net amount is always positive for a valid advance', () => {
    for (const amount of [500, 1000, 5000, 50000]) {
      for (const risk of [0, 1, 2, 3, 4, 5]) {
        const { netAmount } = computeAdvanceFee(amount, risk);
        expect(netAmount).toBeGreaterThan(0);
      }
    }
  });

  it('fee percentage is stored as a decimal rounded to 2dp', () => {
    // feePct is in centi-percent (integer), divide by 100 for the stored value
    const { feePercentage } = computeAdvanceFee(5000, 3);
    expect(feePercentage).toBe(4.7);
  });
});
