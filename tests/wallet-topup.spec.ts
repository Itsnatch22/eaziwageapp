import { test, expect } from '@playwright/test';
import * as path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth', 'employer.json');

test.use({ storageState: AUTH_FILE });

test.beforeEach(({ page: _page }) => {
  test.skip(
    !process.env.TEST_EMPLOYER_EMAIL,
    'Skipped — set TEST_EMPLOYER_EMAIL + TEST_EMPLOYER_PASSWORD in .env.local to run employer tests',
  );
});

const WALLET_RESPONSE = {
  wallet: {
    id: 'wallet-test-id',
    employer_id: 'employer-test-id',
    balance: 25000,
    arrears_balance: 0,
    currency: 'KES',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  transactions: [
    {
      id: 'tx-001',
      wallet_id: 'wallet-test-id',
      amount: 10000,
      transaction_type: 'deposit',
      status: 'completed',
      description: 'Top-up',
      reference: 'DEP-001',
      created_at: new Date().toISOString(),
    },
  ],
};

test.describe('Employer — Wallet Top-up', () => {
  test('submits a top-up request and shows success toast', async ({ page }) => {
    await page.route('**/api/employer-dashboard/status', async (route) => {
      await route.fulfill({ json: { status: 'active' } });
    });
    await page.route('**/api/employer-dashboard/profile', async (route) => {
      await route.fulfill({ json: { profile: { id: 'employer-test-id', company_name: 'Test Corp' } } });
    });

    // Mock wallet data — GET and POST in one handler to avoid LIFO override
    await page.route('**/api/employer-dashboard/wallet', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: WALLET_RESPONSE });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({ json: { success: true } });
      } else {
        await route.continue();
      }
    });

    // Mock wallet transactions endpoint
    await page.route('**/api/employer-dashboard/wallet/transactions', async (route) => {
      await route.fulfill({ json: { transactions: WALLET_RESPONSE.transactions, balance: 25000, currency: 'KES' } });
    });

    await page.goto('/dashboards/employer-dashboard/wallet');

    // Wait for wallet page to load with balance visible
    await expect(page.getByText('25,000').or(page.getByText('25000'))).toBeVisible({ timeout: 10_000 });

    // Open the top-up modal
    await page.getByRole('button', { name: /top-up wallet/i }).click();

    // Modal is now visible — fill in the amount
    await expect(page.getByPlaceholder(/enter amount/i)).toBeVisible();
    await page.getByPlaceholder(/enter amount/i).fill('5000');

    // Submit
    await page.getByRole('button', { name: /request top-up/i }).click();

    // Success toast
    await expect(page.getByText(/submitted.*admin|top-up.*submitted/i)).toBeVisible({ timeout: 8_000 });
  });

  test('shows validation error for zero amount', async ({ page }) => {
    await page.route('**/api/employer-dashboard/status', async (route) => {
      await route.fulfill({ json: { status: 'active' } });
    });
    await page.route('**/api/employer-dashboard/profile', async (route) => {
      await route.fulfill({ json: { profile: { id: 'employer-test-id', company_name: 'Test Corp' } } });
    });
    await page.route('**/api/employer-dashboard/wallet', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: WALLET_RESPONSE });
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboards/employer-dashboard/wallet');
    await expect(page.getByText('25,000').or(page.getByText('25000'))).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /top-up wallet/i }).click();
    await expect(page.getByPlaceholder(/enter amount/i)).toBeVisible();

    // Submit without entering an amount (default is 0)
    await page.getByRole('button', { name: /request top-up/i }).click();

    await expect(page.getByText(/valid amount/i)).toBeVisible({ timeout: 5_000 });
  });

  test('shows error toast when top-up POST fails', async ({ page }) => {
    await page.route('**/api/employer-dashboard/status', async (route) => {
      await route.fulfill({ json: { status: 'active' } });
    });
    await page.route('**/api/employer-dashboard/profile', async (route) => {
      await route.fulfill({ json: { profile: { id: 'employer-test-id', company_name: 'Test Corp' } } });
    });
    await page.route('**/api/employer-dashboard/wallet', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: WALLET_RESPONSE });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({ status: 403, json: { error: 'Employer not approved' } });
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboards/employer-dashboard/wallet');
    await expect(page.getByText('25,000').or(page.getByText('25000'))).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /top-up wallet/i }).click();
    await expect(page.getByPlaceholder(/enter amount/i)).toBeVisible();
    await page.getByPlaceholder(/enter amount/i).fill('1000');
    await page.getByRole('button', { name: /request top-up/i }).click();

    await expect(page.getByText(/employer not approved|failed/i)).toBeVisible({ timeout: 8_000 });
  });

  test('displays existing wallet balance and transactions', async ({ page }) => {
    await page.route('**/api/employer-dashboard/status', async (route) => {
      await route.fulfill({ json: { status: 'active' } });
    });
    await page.route('**/api/employer-dashboard/profile', async (route) => {
      await route.fulfill({ json: { profile: { id: 'employer-test-id', company_name: 'Test Corp' } } });
    });
    await page.route('**/api/employer-dashboard/wallet', async (route) => {
      await route.fulfill({ json: WALLET_RESPONSE });
    });

    await page.goto('/dashboards/employer-dashboard/wallet');

    await expect(page.getByText('25,000').or(page.getByText('25000'))).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('KES').or(page.getByText('Kenyan Shilling'))).toBeVisible();
  });
});
