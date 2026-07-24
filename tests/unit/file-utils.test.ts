import { describe, it, expect } from 'vitest';
import { computeChecksum } from '@/lib/fileUtils';
import { evaluateScanResult } from '@/lib/scanService';

describe('fileUtils.computeChecksum', () => {
  it('computes consistent sha256 checksums', () => {
    const buf = Buffer.from('hello world');
    const sum = computeChecksum(buf);
    expect(sum).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });
});

describe('scanService.evaluateScanResult', () => {
  it('flags when checksum mismatches', () => {
    const buf = Buffer.from('abc');
    const res = evaluateScanResult(buf, 'deadbeef');
    expect(res.status).toBe('flagged');
    expect(res.reason).toBe('checksum_mismatch');
  });

  it('flags when oversized', () => {
    const big = Buffer.alloc(6 * 1024 * 1024, 0); // 6MB
    const res = evaluateScanResult(big, null);
    expect(res.status).toBe('flagged');
    expect(res.reason).toBe('oversize');
  });

  it('marks small matching files as clean', () => {
    const buf = Buffer.from('small content');
    const checksum = computeChecksum(buf);
    const res = evaluateScanResult(buf, checksum);
    expect(res.status).toBe('clean');
  });
});
