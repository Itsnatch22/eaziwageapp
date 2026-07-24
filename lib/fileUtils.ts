import { createHash } from 'crypto';
import { MAX_FILE_SIZE } from './validations/kyc-validation';

export function computeChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function isUnderMaxSize(buffer: Buffer): boolean {
  return buffer.length <= MAX_FILE_SIZE;
}
