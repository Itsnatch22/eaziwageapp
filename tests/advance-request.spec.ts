/**
 * Playwright API tests for POST /api/employee-dashboard/request-advance.
 *
 * Auth-free tests verify the auth guard always fires.
 * Authenticated tests use tests/.auth/employee.json (created by global-setup when
 * TEST_EMPLOYEE_EMAIL + TEST_EMPLOYEE_PASSWORD are set in .env.local).
 * They skip gracefully when no employee credentials are available.
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const ENDPOINT = '/api/employee-dashboard/request-advance';

// ─── No-auth tests (always run) ───────────────────────────────────────────────

test('request-advance: no auth → 401', async ({ request }) => {
  const res = await request.post(ENDPOINT, {
    data: { amount: 5000, disbursement_method: 'mobile_money' },
  });
  expect(res.status()).toBe(401);
});

test('request-advance: no auth, malformed body → still 401 (auth checked first)', async ({ request }) => {
  const res = await request.post(ENDPOINT, {
    data: { bad: 'payload' },
  });
  expect(res.status()).toBe(401);
});

// ─── Authenticated employee tests ─────────────────────────────────────────────

const EMPLOYEE_AUTH_FILE = path.join(__dirname, '.auth', 'employee.json');

function hasEmployeeAuth(): boolean {
  try {
    const state = JSON.parse(fs.readFileSync(EMPLOYEE_AUTH_FILE, 'utf8'));
    return Array.isArray(state.cookies) && state.cookies.length > 0;
  } catch {
    return false;
  }
}

test.describe('authenticated employee', () => {
  test.use({ storageState: EMPLOYEE_AUTH_FILE });

  test.beforeEach(async () => {
    if (!hasEmployeeAuth()) {
      test.skip(true, 'No employee auth — set TEST_EMPLOYEE_EMAIL / TEST_EMPLOYEE_PASSWORD in .env.local');
    }
  });

  test('invalid disbursement_method → 422', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: { amount: 5000, disbursement_method: 'cash' },
    });
    expect(res.status()).toBe(422);
  });

  test('zero amount → 422', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: { amount: 0, disbursement_method: 'mobile_money' },
    });
    expect(res.status()).toBe(422);
  });

  test('negative amount → 422', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: { amount: -100, disbursement_method: 'mobile_money' },
    });
    expect(res.status()).toBe(422);
  });

  test('string amount → 422', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: { amount: '5000', disbursement_method: 'mobile_money' },
    });
    expect(res.status()).toBe(422);
  });

  test('valid schema passes auth and validation layers', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: { amount: 5000, disbursement_method: 'mobile_money' },
    });
    // Auth passed (not 401). Schema valid (not 422).
    // Business logic may return 403 (not approved), 404 (no employee record),
    // 400 (no payment method), 409 (pending exists), or 201 (success).
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(422);
  });

  test('response body has message field on error', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: { amount: -1, disbursement_method: 'mobile_money' },
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(typeof body.message).toBe('string');
  });
});
