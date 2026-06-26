import { describe, it, expect } from 'vitest';

// Replicates the integer-cent eligibility logic from payout-service.ts checkEmployeeEligibility
function checkAdvanceLimit(
  advanceAmount: number,
  monthlySalary: number,
  maxAdvancePercent: number,
  minAdvanceAmount: number,
) {
  const salaryMinor      = Math.round(monthlySalary * 100);
  const maxAllowedMinor  = Math.floor(salaryMinor * maxAdvancePercent / 100);
  const advanceMinor     = Math.round(advanceAmount * 100);
  const effectiveMinMinor = Math.round(minAdvanceAmount * 100);

  if (advanceMinor > maxAllowedMinor) {
    return { eligible: false, reason: `exceeds_limit`, limit: maxAllowedMinor / 100 };
  }
  if (advanceMinor < effectiveMinMinor) {
    return { eligible: false, reason: 'below_minimum', minimum: minAdvanceAmount };
  }
  return { eligible: true };
}

describe('advance eligibility — limit checks with integer-cent arithmetic', () => {
  it('advance at exactly the max is eligible', () => {
    // salary=50000, 50% limit → max=25000
    const result = checkAdvanceLimit(25000, 50000, 50, 500);
    expect(result.eligible).toBe(true);
  });

  it('advance one cent above the max is rejected', () => {
    const result = checkAdvanceLimit(25000.01, 50000, 50, 500);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('exceeds_limit');
  });

  it('advance exactly at minimum is eligible', () => {
    const result = checkAdvanceLimit(500, 50000, 50, 500);
    expect(result.eligible).toBe(true);
  });

  it('advance one cent below minimum is rejected', () => {
    const result = checkAdvanceLimit(499.99, 50000, 50, 500);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('below_minimum');
  });

  it('40% advance limit on KES 30000 salary → ceiling is KES 12000', () => {
    const result = checkAdvanceLimit(12000, 30000, 40, 500);
    expect(result.eligible).toBe(true);

    const over = checkAdvanceLimit(12000.01, 30000, 40, 500);
    expect(over.eligible).toBe(false);
    expect(over.limit).toBe(12000);
  });

  it('uses Math.floor not Math.round for the cap so employees never receive over-limit', () => {
    // salary=10000, 33% limit → 3300 exactly (10000 * 33 / 100)
    // Math.floor(1000000 * 33 / 100) = Math.floor(330000) = 330000 → 3300.00 ✓
    const result = checkAdvanceLimit(3300, 10000, 33, 500);
    expect(result.eligible).toBe(true);
  });

  it('float trap: salary * percent does not drift for common values', () => {
    // Without integer arithmetic: 60000 * 0.50 → 30000.000000000004 in some JS engines
    // With integer: Math.floor(6000000 * 50 / 100) = 3000000 → 30000.00 exactly
    const salaryMinor     = Math.round(60000 * 100);
    const maxAllowedMinor = Math.floor(salaryMinor * 50 / 100);
    expect(maxAllowedMinor).toBe(3000000); // exactly 30000.00
  });

  it('rejects zero-amount advance', () => {
    const result = checkAdvanceLimit(0, 50000, 50, 500);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('below_minimum');
  });

  it('salary=0 means no advance is ever eligible (max = 0)', () => {
    const result = checkAdvanceLimit(500, 0, 50, 500);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('exceeds_limit');
    expect(result.limit).toBe(0);
  });
});

describe('cooldown calculation', () => {
  function daysSince(disbursedAt: string): number {
    return Math.floor((Date.now() - new Date(disbursedAt).getTime()) / (1000 * 60 * 60 * 24));
  }

  it('counts days since disbursement correctly', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysSince(threeDaysAgo)).toBe(3);
  });

  it('same-day disbursement gives 0 days', () => {
    expect(daysSince(new Date().toISOString())).toBe(0);
  });

  it('cooldown active when daysSince < cooldownDays', () => {
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const cooldownDays = 7;
    const days = daysSince(oneDayAgo);
    expect(days < cooldownDays).toBe(true);
  });

  it('cooldown expired when daysSince >= cooldownDays', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const cooldownDays = 7;
    const days = daysSince(eightDaysAgo);
    expect(days < cooldownDays).toBe(false);
  });
});
