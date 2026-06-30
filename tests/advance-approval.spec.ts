import { test, expect } from '@playwright/test';
import * as path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth', 'admin.json');

test.use({ storageState: AUTH_FILE });

test.beforeEach(() => {
  test.skip(
    !process.env.TEST_ADMIN_EMAIL,
    'Skipped — set TEST_ADMIN_EMAIL + TEST_ADMIN_PASSWORD in .env.local to run admin tests',
  );
});

// Seeded advance used across approval and denial tests
const PENDING_ADVANCE = {
  id: 'test-advance-id-001',
  employee_id: 'emp-id-001',
  organization_id: 'org-id-001',
  amount: 5000,
  fee_amount: 100,
  fee_percentage: 2,
  net_amount: 4900,
  disbursement_method: 'mobile_money',
  status: 'pending',
  created_at: new Date().toISOString(),
  requested_at: new Date().toISOString(),
  approved_at: null,
  employer_id: 'employer-id-001',
  currency: 'KES',
  employee_name: 'Jane Doe',
  employee_code: 'EMP-TEST-001',
  employer_name: 'Acme Corp',
};

const ADVANCES_RESPONSE = {
  advances: [PENDING_ADVANCE],
  pagination: { total: 1, page: 0, limit: 50, hasMore: false },
};

test.describe('Admin — Advance Approval', () => {
  test('approves a pending advance and shows success toast', async ({ page }) => {
    // Mock the advances list endpoint
    await page.route('**/api/admin/advances**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: ADVANCES_RESPONSE });
      } else {
        await route.continue();
      }
    });

    // Mock the approve endpoint
    await page.route(`**/api/admin/advances/${PENDING_ADVANCE.id}/approve`, async (route) => {
      await route.fulfill({ json: { success: true, message: 'Advance approved' } });
    });

    await page.goto('/admin/advances');

    // The page renders the advance table
    await expect(page.getByTestId('admin-advances-page')).toBeVisible({ timeout: 10_000 });

    // Find the row for our test advance and click the approve action
    const advanceRow = page.getByText('Jane Doe').first();
    await expect(advanceRow).toBeVisible();

    // Open the dropdown menu for this advance (MoreHorizontal icon button)
    const row = page.locator('tr, [role="row"]').filter({ hasText: 'Jane Doe' }).first();
    await row.getByRole('button').last().click();

    // Click "Approve" in the dropdown
    await page.getByRole('menuitem', { name: /approve/i }).click();

    // Success toast
    await expect(page.getByText(/advance approved/i)).toBeVisible({ timeout: 8000 });
  });

  test('denies a pending advance and shows success toast', async ({ page }) => {
    await page.route('**/api/admin/advances**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: ADVANCES_RESPONSE });
      } else {
        await route.continue();
      }
    });

    await page.route(`**/api/admin/advances/${PENDING_ADVANCE.id}/deny`, async (route) => {
      await route.fulfill({ json: { success: true } });
    });

    await page.goto('/admin/advances');
    await expect(page.getByTestId('admin-advances-page')).toBeVisible({ timeout: 10_000 });

    const row = page.locator('tr, [role="row"]').filter({ hasText: 'Jane Doe' }).first();
    await row.getByRole('button').last().click();

    await page.getByRole('menuitem', { name: /deny|reject/i }).click();
    await expect(page.getByText(/denied|rejected/i)).toBeVisible({ timeout: 8_000 });
  });

  test('shows error toast when approval API fails', async ({ page }) => {
    await page.route('**/api/admin/advances**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: ADVANCES_RESPONSE });
      } else {
        await route.continue();
      }
    });

    await page.route(`**/api/admin/advances/${PENDING_ADVANCE.id}/approve`, async (route) => {
      await route.fulfill({ status: 400, json: { error: 'Monthly limit reached' } });
    });

    await page.goto('/admin/advances');
    await expect(page.getByTestId('admin-advances-page')).toBeVisible({ timeout: 10_000 });

    const row = page.locator('tr, [role="row"]').filter({ hasText: 'Jane Doe' }).first();
    await row.getByRole('button').last().click();
    await page.getByRole('menuitem', { name: /approve/i }).click();

    // Error toast
    await expect(page.getByText(/monthly limit reached|failed/i)).toBeVisible({ timeout: 8000 });
  });

  test('filters advances by pending status', async ({ page }) => {
    await page.route('**/api/admin/advances**', async (route) => {
      await route.fulfill({ json: ADVANCES_RESPONSE });
    });

    await page.goto('/admin/advances');
    await expect(page.getByTestId('admin-advances-page')).toBeVisible({ timeout: 10_000 });

    // The advance row must be visible before filtering
    await expect(page.getByText('Jane Doe')).toBeVisible({ timeout: 8_000 });

    // Click the "Pending" filter — filtering is client-side (setStatusFilter)
    await page.getByRole('button', { name: /^pending/i }).first().click();

    // The pending advance (Jane Doe, status='pending') must still be visible
    await expect(page.getByText('Jane Doe')).toBeVisible({ timeout: 5_000 });

    // Click "Approved" — should hide the pending advance
    await page.getByRole('button', { name: /^approved/i }).first().click();
    await expect(page.getByText('Jane Doe')).not.toBeVisible({ timeout: 5_000 });
  });
});
