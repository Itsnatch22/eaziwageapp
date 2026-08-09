import { test, expect } from 'vitest';
import { createHmac } from 'crypto';
import { verifyWebhookSignature } from '../../lib/dusupay/client';

function buildSignature(rawBody: string, secret: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const hmac = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return `t=${timestamp},s=${hmac}`;
}

test('verifyWebhookSignature returns true for a valid signature', () => {
  const secret = 'test-dusupay-secret';
  process.env.DUSUPAY_WEBHOOK_SECRET = secret;
  const body = JSON.stringify({ event: 'TEST', payload: { ok: true } });
  const sig = buildSignature(body, secret);
  expect(verifyWebhookSignature(body, sig)).toBe(true);
});

test('verifyWebhookSignature returns false for an invalid signature', () => {
  process.env.DUSUPAY_WEBHOOK_SECRET = 'test-dusupay-secret';
  const body = JSON.stringify({ event: 'TEST', payload: { ok: true } });
  expect(verifyWebhookSignature(body, 'invalid-signature')).toBe(false);
});
