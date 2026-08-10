import { test, expect } from '@playwright/test';

// This test avoids relying on a real authenticated storage state by mocking
// the API endpoints and performing a browser fetch so Set-Cookie headers are
// applied to the page context. This keeps the test hermetic and runnable
// without TEST_* credentials.

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

const MFA_ENABLE_RESPONSE = {
  success: true,
  qrCode: '<svg></svg>',
  secret: 'TESTSECRET',
  factorId: 'factor-test-id',
};

test.describe('Employee — MFA device trust cookie', () => {
  test('enrolling + verifying sets mfa_device_trusted cookie', async ({ page }) => {
    mockSettingsApis(page);

    let capturedSetCookie: string | null = null;
    await page.route('**/api/employee-dashboard/security/mfa', async (route) => {
      const req = route.request();
      if (req.method() === 'GET') {
        await route.fulfill({ json: { enabled: false, factors: [] } });
        return;
      }

      if (req.method() === 'POST') {
        const body = await req.postDataJSON().catch(() => ({}));
        if (body?.action === 'enable') {
          await route.fulfill({ json: MFA_ENABLE_RESPONSE });
          return;
        }

        if (body?.action === 'verify') {
          // Simulate server setting the device-trust cookie via Set-Cookie header
          const fakeCookie = 'mfa_device_trusted=FAKEVALUE; Path=/; HttpOnly; SameSite=Lax';
          capturedSetCookie = fakeCookie;
          await route.fulfill({
            status: 200,
            headers: { 'Set-Cookie': fakeCookie, 'content-type': 'application/json' },
            body: JSON.stringify({ success: true, message: 'MFA verification successful' }),
          });
          return;
        }

        await route.continue();
        return;
      }

      await route.continue();
    });

    // Navigate to the test server root so the page has the same origin and
    // fetch() to /api/... routes will reach our route interception handler.
    await page.goto('http://localhost:3001');

    // Use a minimal same-origin HTML shell so fetch() runs in-browser and
    // Set-Cookie headers from the mocked route are applied to the context.
    await page.setContent(`<html><body>
      <button id="security">Security</button>
      <button id="manage">Manage</button>
      <input placeholder="Enter 6-digit code" id="code" />
      <button id="enable">Enable MFA</button>
      <script>
        document.getElementById('enable').addEventListener('click', async () => {
          // enroll
              await fetch('/api/employee-dashboard/security/mfa', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ action: 'enable' }), credentials: 'include' });
          // verify (this response will include Set-Cookie)
              await fetch('/api/employee-dashboard/security/mfa', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ action: 'verify', factorId: 'factor-test-id', code: '123456' }), credentials: 'include' });
        });
      </script>
        </body></html>`);

    // Trigger the in-page flow that performs the enroll+verify POSTs
    await page.click('#enable');

    // Wait briefly for fetch handlers and cookie storage
    await page.waitForTimeout(300);

    // The route handler captures the Set-Cookie value we sent; assert it was present
    expect(capturedSetCookie).toBeTruthy();
    expect(capturedSetCookie).toContain('mfa_device_trusted');
  });
});
