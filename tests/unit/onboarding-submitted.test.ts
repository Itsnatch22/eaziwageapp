import { describe, expect, it } from 'vitest';
import {
  hasSubmittedOnboarding,
  shouldRedirectEmployerFromOnboarding,
} from '@/lib/server/onboarding-submitted';

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

  it('does not treat approved KYC status as submitted without a timestamp', () => {
    expect(hasSubmittedOnboarding({ status: 'approved', submitted_at: null })).toBe(false);
  });

  it('treats the first KYC upload rollup as pending onboarding until actual submission', () => {
    expect(hasSubmittedOnboarding({ status: 'pending', submitted_at: null })).toBe(false);
  });
});

describe('employer onboarding wizard redirect', () => {
  it.each([
    ['pending KYC rollup without submission timestamp', 'pending', null, null, false],
    ['submitted application', 'pending', '2026-10-19T00:00:00.000Z', null, true],
    ['rejected application remains editable', 'rejected', '2026-10-19T00:00:00.000Z', null, false],
    ['held account stays out of the wizard', 'pending', null, 'suspended', true],
  ])('%s', (_name, status, submittedAt, accountStatus, expected) => {
    expect(shouldRedirectEmployerFromOnboarding(
      status,
      submittedAt,
      accountStatus,
    )).toBe(expected);
  });
});
