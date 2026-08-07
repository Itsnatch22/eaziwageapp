import { describe, it, expect, vi } from 'vitest';
import { scanBufferWithClamAV } from '@/lib/clamavAdapter';
import { evaluateScanResultWithClamAV } from '@/lib/scanService';
import { computeChecksum } from '@/lib/fileUtils';

describe('clamavAdapter', () => {
  it('handles unreachable ClamAV gracefully', async () => {
    const buf = Buffer.from('test pdf content');
    const res = await scanBufferWithClamAV(buf, { host: '127.0.0.1', port: 19999, timeoutMs: 500 });
    expect(res.status).toBe('unavailable');
    expect(res.message).toContain('connection failed');
  });
});

describe('scanService with ClamAV', () => {
  it('flags checksum mismatch before calling ClamAV', async () => {
    const buf = Buffer.from('abc');
    const res = await evaluateScanResultWithClamAV(buf, 'wrongchecksum');
    expect(res.status).toBe('flagged');
    expect(res.reason).toBe('checksum_mismatch');
  });

  it('flags oversize files before calling ClamAV', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024, 0);
    const res = await evaluateScanResultWithClamAV(big, null);
    expect(res.status).toBe('flagged');
    expect(res.reason).toBe('oversize');
  });

  it('falls back to clean if ClamAV server is unreachable in dev mode', async () => {
    const buf = Buffer.from('clean document');
    const checksum = computeChecksum(buf);
    const res = await evaluateScanResultWithClamAV(buf, checksum, { host: '127.0.0.1', port: 19999 });
    expect(res.status).toBe('clean');
    expect(res.reason).toContain('ok_fallback');
  });
});
