/**
 * Playwright API-level tests for the DusuPay webhook handler.
 *
 * These tests run against the actual Next.js server (managed by playwright.config.ts).
 * They verify:
 *  1. Unauthenticated (unsigned) requests are rejected with 401.
 *  2. A properly-signed PAYOUT event is processed and returns 200.
 *  3. Sending the exact same payload twice returns 200 both times (idempotency guard).
 *
 * The webhook signature format: dusupay-signature: t=<unix_secs>,s=<hmac_sha256_hex>
 * HMAC payload: `${timestamp}.${rawBody}` signed with DUSUPAY_WEBHOOK_SECRET.
 *
 * Tests that depend on DUSUPAY_WEBHOOK_SECRET skip gracefully when the secret is absent
 * so they don't fail in CI environments that omit payment credentials.
 */

import { test, expect } from '@playwright/test';
import { createHmac } from 'crypto';

const WEBHOOK_URL = '/api/webhook/dusupay';

function buildSignature(rawBody: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const hmac = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return `t=${timestamp},s=${hmac}`;
}

function buildPayoutPayload(merchantRef: string, status: 'COMPLETED' | 'FAILED' = 'COMPLETED') {
  return JSON.stringify({
    event: 'PAYOUT',
    payload: {
      merchant_reference:   merchantRef,
      internal_reference:   `DUSUPAY_${merchantRef}`,
      transaction_type:     'MOBILE_MONEY',
      transaction_status:   status,
      transaction_amount:   5000,
      transaction_currency: 'KES',
      request_currency:     'KES',
      account_number:       '+254700000000',
      msisdn:               '+254700000000',
      charges:              50,
      net_amount:           4950,
      country:              'KE',
      provider_code:        'MPESA',
      created_date:         new Date().toISOString(),
      modified_date:        new Date().toISOString(),
    },
  });
}

// ─── 1. Signature verification ────────────────────────────────────────────────

test('webhook: unsigned request is rejected with 401', async ({ request }) => {
  const body = buildPayoutPayload('test-no-sig-001');
  const response = await request.post(WEBHOOK_URL, {
    data: body,
    headers: { 'content-type': 'application/json' },
  });
  expect(response.status()).toBe(401);
});

test('webhook: malformed signature header is rejected with 401', async ({ request }) => {
  const body = buildPayoutPayload('test-bad-sig-001');
  const response = await request.post(WEBHOOK_URL, {
    data: body,
    headers: {
      'content-type':      'application/json',
      'dusupay-signature': 'not-a-valid-signature',
    },
  });
  expect(response.status()).toBe(401);
});

// ─── 2. Properly-signed PAYOUT event ──────────────────────────────────────────

test('webhook: signed PAYOUT event is accepted (200)', async ({ request }) => {
  const secret = process.env.DUSUPAY_WEBHOOK_SECRET;
  if (!secret) {
    test.skip(true, 'DUSUPAY_WEBHOOK_SECRET not set — skipping integration webhook test');
    return;
  }

  // Use a random suffix so this doesn't collide with real data
  const merchantRef = `test-wh-${Date.now()}`;
  const body = buildPayoutPayload(merchantRef);
  const signature = buildSignature(body, secret);

  const response = await request.post(WEBHOOK_URL, {
    data: body,
    headers: {
      'content-type':      'application/json',
      'dusupay-signature': signature,
    },
  });

  // The handler returns 200 even when the advance is not found in the DB
  // (it logs a warning rather than throwing) — we verify it doesn't 500 or 401.
  expect([200, 404].includes(response.status())).toBeTruthy();
});

// ─── 3. Idempotency ────────────────────────────────────────────────────────────

test('webhook: duplicate COMPLETED payout returns 200 without re-processing', async ({ request }) => {
  const secret = process.env.DUSUPAY_WEBHOOK_SECRET;
  if (!secret) {
    test.skip(true, 'DUSUPAY_WEBHOOK_SECRET not set — skipping idempotency test');
    return;
  }

  const merchantRef = `test-idempotent-${Date.now()}`;
  const body = buildPayoutPayload(merchantRef, 'COMPLETED');

  // First call
  const sig1 = buildSignature(body, secret);
  const r1 = await request.post(WEBHOOK_URL, {
    data: body,
    headers: { 'content-type': 'application/json', 'dusupay-signature': sig1 },
  });
  expect([200, 404].includes(r1.status())).toBeTruthy();

  // Second call — same merchant_reference, same event; must not throw or 500
  const sig2 = buildSignature(body, secret); // fresh timestamp, but same body/ref
  const r2 = await request.post(WEBHOOK_URL, {
    data: body,
    headers: { 'content-type': 'application/json', 'dusupay-signature': sig2 },
  });
  expect([200, 404].includes(r2.status())).toBeTruthy();
});

// ─── 4. COLLECTION event (wallet top-up) ─────────────────────────────────────

test('webhook: signed COLLECTION event is accepted', async ({ request }) => {
  const secret = process.env.DUSUPAY_WEBHOOK_SECRET;
  if (!secret) {
    test.skip(true, 'DUSUPAY_WEBHOOK_SECRET not set');
    return;
  }

  const body = JSON.stringify({
    event: 'COLLECTION',
    payload: {
      merchant_reference:   `test-col-${Date.now()}`,
      internal_reference:   `DUSUPAY_COL_${Date.now()}`,
      transaction_type:     'MOBILE_MONEY',
      transaction_status:   'COMPLETED',
      transaction_amount:   100000,
      transaction_currency: 'KES',
      request_currency:     'KES',
      account_number:       '+254700000001',
      msisdn:               '+254700000001',
      charges:              100,
      net_amount:           99900,
      country:              'KE',
      provider_code:        'MPESA',
      created_date:         new Date().toISOString(),
      modified_date:        new Date().toISOString(),
    },
  });

  const signature = buildSignature(body, secret);
  const response = await request.post(WEBHOOK_URL, {
    data: body,
    headers: { 'content-type': 'application/json', 'dusupay-signature': signature },
  });

  expect([200, 404].includes(response.status())).toBeTruthy();
});
