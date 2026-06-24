import { test, expect } from '@playwright/test';
import * as path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth', 'employee.json');

test.use({ storageState: AUTH_FILE });

test.beforeEach(({ page: _page }) => {
  test.skip(
    !process.env.TEST_EMPLOYEE_EMAIL,
    'Skipped — set TEST_EMPLOYEE_EMAIL + TEST_EMPLOYEE_PASSWORD in .env.local to run employee tests',
  );
});

const MFA_STATUS_ENABLED = {
  enabled: true,
  factors: [
    {
      id: 'factor-test-id',
      factor_type: 'totp',
      friendly_name: 'EaziWage Authenticator',
      status: 'verified',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
};

const MFA_STATUS_DISABLED = { enabled: false, factors: [] };

const MOCK_BACKUP_CODES = [
  'ABCD-EFGH', '1234-5678', 'WXYZ-MNOP', 'QRST-UVWX',
  'JKLM-NOPQ', 'BCDE-FGHI', '2345-6789', 'XYZA-BCDE',
  'RSTU-VWXY', 'KLMN-OPQR',
];

// Stub out settings page API calls that aren't under test
function mockSettingsApis(page: import('@playwright/test').Page) {
  page.route('**/api/employee-dashboard/profile**', (route) =>
    route.fulfill({ json: { profile: null } }),
  );
  page.route('**/api/employee-dashboard/employment**', (route) =>
    route.fulfill({ json: { employment: null } }),
  );
  page.route('**/api/employee-dashboard/notifications**', (route) =>
    route.fulfill({ json: { notifications: [] } }),
  );
  page.route('**/api/employee-dashboard/security/activity**', (route) =>
    route.fulfill({ json: { activity: [] } }),
  );
}

test.describe('Employee — MFA Backup Codes', () => {
  test('generates backup codes when MFA is enabled and displays them', async ({ page }) => {
    mockSettingsApis(page);

    // MFA status: enabled with a verified factor
    await page.route('**/api/employee-dashboard/security/mfa', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: MFA_STATUS_ENABLED });
      } else if (route.request().method() === 'POST') {
        const body = await route.request().postDataJSON();
        if (body?.action === 'generate_backup_codes') {
          await route.fulfill({ json: { backupCodes: MOCK_BACKUP_CODES } });
        } else {
          await route.continue();
        }
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboards/employee-dashboard/settings');

    // Find and click the "Manage" button to open the MFA modal
    await page.getByRole('button', { name: /manage/i }).first().click();

    // MFA modal should be visible
    await expect(page.getByText(/manage mfa.*backup codes/i)).toBeVisible({ timeout: 8_000 });

    // Click "Generate Backup Codes"
    await page.getByRole('button', { name: /generate backup codes/i }).click();

    // Backup codes should appear — verify a few
    for (const code of MOCK_BACKUP_CODES.slice(0, 3)) {
      await expect(page.getByText(code)).toBeVisible({ timeout: 5_000 });
    }

    // "Done" button should be visible
    await expect(page.getByRole('button', { name: /done/i })).toBeVisible();
  });

  test('shows error toast when backup code generation fails', async ({ page }) => {
    mockSettingsApis(page);

    await page.route('**/api/employee-dashboard/security/mfa', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: MFA_STATUS_ENABLED });
      } else if (route.request().method() === 'POST') {
        const body = await route.request().postDataJSON();
        if (body?.action === 'generate_backup_codes') {
          await route.fulfill({ status: 500, json: { error: 'Backup code signing not configured' } });
        } else {
          await route.continue();
        }
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboards/employee-dashboard/settings');

    await page.getByRole('button', { name: /manage/i }).first().click();
    await expect(page.getByText(/manage mfa.*backup codes/i)).toBeVisible({ timeout: 8_000 });

    await page.getByRole('button', { name: /generate backup codes/i }).click();

    await expect(page.getByText(/signing not configured|failed to generate/i)).toBeVisible({ timeout: 5_000 });
  });

  test('backup code generation API sends correct action payload', async ({ page }) => {
    mockSettingsApis(page);

    let capturedBody: Record<string, unknown> | null = null;

    await page.route('**/api/employee-dashboard/security/mfa', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: MFA_STATUS_ENABLED });
      } else if (route.request().method() === 'POST') {
        capturedBody = await route.request().postDataJSON();
        await route.fulfill({ json: { backupCodes: MOCK_BACKUP_CODES } });
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboards/employee-dashboard/settings');
    await page.getByRole('button', { name: /manage/i }).first().click();
    await expect(page.getByText(/manage mfa.*backup codes/i)).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: /generate backup codes/i }).click();

    // Wait for codes to appear then verify the request body
    await expect(page.getByText(MOCK_BACKUP_CODES[0])).toBeVisible({ timeout: 5_000 });
    expect(capturedBody).toMatchObject({ action: 'generate_backup_codes' });
  });

  test('closing the modal clears backup codes', async ({ page }) => {
    mockSettingsApis(page);

    await page.route('**/api/employee-dashboard/security/mfa', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: MFA_STATUS_ENABLED });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({ json: { backupCodes: MOCK_BACKUP_CODES } });
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboards/employee-dashboard/settings');
    await page.getByRole('button', { name: /manage/i }).first().click();
    await expect(page.getByText(/manage mfa.*backup codes/i)).toBeVisible({ timeout: 8_000 });

    await page.getByRole('button', { name: /generate backup codes/i }).click();
    await expect(page.getByText(MOCK_BACKUP_CODES[0])).toBeVisible({ timeout: 5_000 });

    // Close via "Done"
    await page.getByRole('button', { name: /done/i }).click();

    // Modal should be gone
    await expect(page.getByText(/manage mfa.*backup codes/i)).not.toBeVisible({ timeout: 3_000 });
  });
});
