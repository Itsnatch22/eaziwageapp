import { describe, expect, it } from 'vitest';
import { getAdvanceStatusLabel, normalizeAdvanceTerminalStatus } from '@/lib/constants/advance-status';

describe('advance status helpers', () => {
  it('maps disbursement failures to failed', () => {
    expect(normalizeAdvanceTerminalStatus('rejected', 'disbursement_failure')).toBe('failed');
  });

  it('keeps manual rejections as rejected', () => {
    expect(normalizeAdvanceTerminalStatus('rejected', 'manual_rejection')).toBe('rejected');
  });

  it('returns a human-friendly label for failed and rejected', () => {
    expect(getAdvanceStatusLabel('failed')).toBe('Failed');
    expect(getAdvanceStatusLabel('rejected')).toBe('Rejected');
  });
});
