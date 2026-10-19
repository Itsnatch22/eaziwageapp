import { describe, expect, it } from 'vitest';
import { hasSubmittedOnboarding } from '@/lib/server/onboarding-submitted';

describe('hasSubmittedOnboarding', () => {
  it('returns false when there is no onboarding row', () => {
    expect(hasSubmittedOnboarding(null)).toBe(false);
  });

  it('does not treat a pending registration stub as submitted', () => {
    expect(hasSubmittedOnboarding({ status: 'pending', submitted_at: null })).toBe(false);
  });

  it('does not treat an under-review row without a submission timestamp as submitted', () => {
    expect(hasSubmittedOnboarding({ status: 'under_review', submitted_at: null })).toBe(false);
  });

  it('treats a row with a submission timestamp as submitted', () => {
    expect(hasSubmittedOnboarding({ status: 'pending', submitted_at: '2026-10-19T00:00:00.000Z' })).toBe(true);
  });

  it('treats approved rows as submitted without a timestamp', () => {
    expect(hasSubmittedOnboarding({ status: 'approved', submitted_at: null })).toBe(true);
  });
});
