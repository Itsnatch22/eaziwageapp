import { request } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const BASE_URL = 'http://localhost:3001';
const AUTH_DIR = path.join(__dirname, '.auth');
const EMPTY_STATE = JSON.stringify({ cookies: [], origins: [] });

// Authenticate by calling the login API directly.
// The server has PLAYWRIGHT_TEST=1 set, so the reCAPTCHA bypass fires for the sentinel token.
// Playwright's apiContext accumulates Set-Cookie headers automatically — we save them as storage state.
async function loginAndSave(email: string, password: string, filename: string) {
  const dest = path.join(AUTH_DIR, filename);
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  if (!email || !password) {
    fs.writeFileSync(dest, EMPTY_STATE);
    console.warn(`[global-setup] No credentials for ${filename} — wrote empty placeholder`);
    return;
  }

  const apiContext = await request.newContext({ baseURL: BASE_URL });

  try {
    const response = await apiContext.post('/api/auth/login', {
      data: { email, password, recaptcha_token: '__PLAYWRIGHT_TEST__' },
    });

    if (!response.ok()) {
      const body = await response.json().catch(() => ({}));
      console.warn(`[global-setup] Login skipped for ${email}: HTTP ${response.status()} — ${JSON.stringify(body)}`);
      await apiContext.dispose();
      fs.writeFileSync(dest, EMPTY_STATE);
      return;
    }

    const body = await response.json();
    console.log(`[global-setup] Authenticated ${email} (role: ${body.role ?? 'unknown'})`);

    await apiContext.storageState({ path: dest });
    console.log(`[global-setup] Saved ${filename}`);
  } catch (error) {
    console.warn(`[global-setup] Login skipped for ${email}: ${error instanceof Error ? error.message : String(error)}`);
    fs.writeFileSync(dest, EMPTY_STATE);
  } finally {
    await apiContext.dispose();
  }
}

export default async function globalSetup() {
  await loginAndSave(
    process.env.TEST_ADMIN_EMAIL    ?? '',
    process.env.TEST_ADMIN_PASSWORD ?? '',
    'admin.json',
  );
  await loginAndSave(
    process.env.TEST_EMPLOYER_EMAIL    ?? '',
    process.env.TEST_EMPLOYER_PASSWORD ?? '',
    'employer.json',
  );
  await loginAndSave(
    process.env.TEST_EMPLOYEE_EMAIL    ?? '',
    process.env.TEST_EMPLOYEE_PASSWORD ?? '',
    'employee.json',
  );
}
