import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import * as path from 'path';

// Load .env.local so TEST_* credentials are available to the test runner and global-setup.
// Playwright does not load Next.js env files automatically.
loadEnv({ path: path.resolve(__dirname, '.env.local') });

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Playwright manages its own server on port 3001 — never reuses your dev server on 3000.
  // This guarantees PLAYWRIGHT_TEST=1 is always set, enabling the reCAPTCHA bypass.
  webServer: {
    command: 'npx next dev -p 3001',
    url: 'http://localhost:3001',
    env: { PLAYWRIGHT_TEST: '1' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
