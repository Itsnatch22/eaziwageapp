import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  admin: {
    auth: {
      admin: {
        createUser: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
    from: vi.fn(),
  },
  authClient: {
    auth: {
      signInWithPassword: vi.fn(),
    },
  },
  profile: {
    id: 'user-1',
    full_name: 'Test User',
    role: 'employee',
    role_normalized: 'employee',
    email: 'person@example.com',
    email_verified: false,
    locked_until: null as string | null,
    failed_login_attempts: 0,
    is_admin: false,
  },
  failedAttempts: 0,
  profileFound: true,
  updatePayloads: [] as Record<string, unknown>[],
  deletedTables: [] as string[],
  employerInsertError: null as { code: string; message: string } | null,
  createToken: vi.fn(),
  checkRateLimit: vi.fn(),
  validateEmail: vi.fn(),
  handleFailedLoginSecurity: vi.fn(),
  handleLoginSecurity: vi.fn(),
  sendAccountLockedEmail: vi.fn(),
  createUnlockToken: vi.fn(),
}));

vi.mock('@/env', () => ({
  getEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    RECAPTCHA_SECRET_KEY: 'test-recaptcha-secret',
    RESEND_API_KEY: 'test-resend-key',
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mocks.admin,
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => mocks.authClient,
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: vi.fn().mockResolvedValue({ error: null }) };
  },
}));

vi.mock('@react-email/render', () => ({ render: vi.fn().mockResolvedValue('<html></html>') }));
vi.mock('@/lib/emails/WelcomeEmail', () => ({ default: vi.fn(() => null) }));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  loginLimiter: {},
  rateLimiter: {},
  resendLimiter: {},
  getRateLimitRetryMinutes: vi.fn(() => 1),
}));
vi.mock('@/lib/email-validation', () => ({ validateEmail: mocks.validateEmail }));
vi.mock('@/lib/token', () => ({ createToken: mocks.createToken }));
vi.mock('@/lib/utils', () => ({ getCurrencyFromCountry: vi.fn(() => 'KES') }));
vi.mock('@/lib/notifications', () => ({
  notifyAdmin: vi.fn(),
  notifyEmployer: vi.fn(),
}));
vi.mock('@/lib/services/resolve-employer-by-code', () => ({
  resolveEmployerByCode: vi.fn(),
}));
vi.mock('@/lib/security-alerts', () => ({
  sendAccountLockedEmail: mocks.sendAccountLockedEmail,
}));
vi.mock('@/lib/unlock-token', () => ({
  createUnlockToken: mocks.createUnlockToken,
}));
vi.mock('@/lib/security-service', () => ({
  handleFailedLoginSecurity: mocks.handleFailedLoginSecurity,
  handleLoginSecurity: mocks.handleLoginSecurity,
}));
vi.mock('@/lib/server/resolve-user-role', () => ({
  normalizeAppRole: vi.fn((role: string | null) => role),
  resolveRoleFromTables: vi.fn(),
}));

import { POST as loginPost } from '@/app/api/auth/login/route';
import { POST as registerPost } from '@/app/api/auth/register/route';
import { POST as resendVerificationPost } from '@/app/api/auth/resend-verification/route';

function queryFor(table: string) {
  let result = { data: null as unknown, error: null as unknown };
  let selectedColumns = '';
  const query: Record<string, unknown> = {};

  query.select = vi.fn((columns: string) => {
    selectedColumns = columns;
    return query;
  });
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => ({
    data: table === 'system_admins' ? null : mocks.profile,
    error: null,
  }));
  query.single = vi.fn(async () => {
    if (table === 'profiles' && selectedColumns.includes('failed_login_attempts')) {
      return { data: { failed_login_attempts: mocks.failedAttempts }, error: null };
    }
    if (table === 'profiles' && mocks.profileFound) return { data: mocks.profile, error: null };
    if (table === 'employer_onboarding') return { data: { id: 'onboarding-1' }, error: null };
    return { data: null, error: null };
  });
  query.update = vi.fn((payload: Record<string, unknown>) => {
    mocks.updatePayloads.push(payload);
    result = { data: null, error: null };
    return query;
  });
  query.insert = vi.fn(() => {
    result = table === 'employers' && mocks.employerInsertError
      ? { data: null, error: mocks.employerInsertError }
      : { data: null, error: null };
    return query;
  });
  query.delete = vi.fn(() => {
    mocks.deletedTables.push(table);
    result = { data: null, error: null };
    return query;
  });
  query.upsert = vi.fn(() => query);
  query.is = vi.fn(() => query);
  query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);

  return query;
}

function loginRequest() {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'person@example.com',
      password: 'wrong-password',
      recaptcha_token: 'valid-test-token',
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.profile.email_verified = false;
  mocks.profile.locked_until = null;
  mocks.failedAttempts = 0;
  mocks.profileFound = true;
  mocks.updatePayloads.length = 0;
  mocks.deletedTables.length = 0;
  mocks.employerInsertError = null;
  mocks.checkRateLimit.mockResolvedValue({ success: true, headers: {} });
  mocks.validateEmail.mockResolvedValue({ valid: true });
  mocks.handleFailedLoginSecurity.mockResolvedValue(undefined);
  mocks.handleLoginSecurity.mockResolvedValue(undefined);
  mocks.createUnlockToken.mockResolvedValue('unlock-token');
  mocks.createToken.mockResolvedValue({ token: 'verification-token', tokenHash: 'hashed-token' });
  mocks.admin.auth.admin.deleteUser.mockResolvedValue({ error: null });
  mocks.admin.from.mockImplementation((table: string) => queryFor(table));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: async () => ({ success: true, score: 0.9 }),
  }));
});

describe('login route auth error handling', () => {
  it('returns EMAIL_NOT_VERIFIED without recording a failed password attempt', async () => {
    mocks.authClient.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    });

    const response = await loginPost(loginRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
    expect(mocks.updatePayloads).toHaveLength(0);
    expect(mocks.handleFailedLoginSecurity).not.toHaveBeenCalled();
  });

  it('tracks invalid credentials and locks on the fifth failed attempt', async () => {
    mocks.profile.email_verified = true;
    mocks.failedAttempts = 4;
    mocks.authClient.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    });

    const response = await loginPost(loginRequest());

    expect(response.status).toBe(401);
    expect(mocks.updatePayloads).toHaveLength(1);
    expect(mocks.updatePayloads[0]).toMatchObject({ failed_login_attempts: 5 });
    expect(mocks.updatePayloads[0].locked_until).toEqual(expect.any(String));
    expect(mocks.handleFailedLoginSecurity).toHaveBeenCalledOnce();
    expect(mocks.sendAccountLockedEmail).toHaveBeenCalledOnce();
  });
});

describe('register route duplicate email handling', () => {
  it('returns 409 for Supabase email_exists errors', async () => {
    mocks.admin.auth.admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { code: 'email_exists', message: 'User already registered', status: 422 },
    });

    const request = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Test User',
        email: 'person@example.com',
        phone: '+254700000000',
        phone_country_code: 'KE',
        password: 'Password1',
        role: 'employee',
        company_code: '',
        company_name: '',
        recaptcha_token: 'valid-test-token',
      }),
    });

    const response = await registerPost(request);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: 'An account with this email address already exists.',
    });
  });

  it('creates an unconfirmed account without setting a session cookie', async () => {
    mocks.admin.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: 'new-user' } },
      error: null,
    });

    const request = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Test User',
        email: 'person@example.com',
        phone: '+254700000000',
        phone_country_code: 'KE',
        password: 'Password1',
        role: 'employee',
        company_code: '',
        company_name: '',
        recaptcha_token: 'valid-test-token',
      }),
    });

    const response = await registerPost(request);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      message: 'Account created. Please check your email to verify your address.',
      userId: 'new-user',
      role: 'employee',
    });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(mocks.authClient.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.admin.auth.admin.createUser).toHaveBeenCalledWith(expect.objectContaining({
      email_confirm: false,
    }));
  });

  it('does not replace an employer when a company-code unique constraint conflicts', async () => {
    mocks.admin.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: 'new-employer' } },
      error: null,
    });
    mocks.employerInsertError = { code: '23505', message: 'duplicate company_code' };

    const request = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Test User',
        email: 'employer@example.com',
        phone: '+254700000000',
        phone_country_code: 'KE',
        password: 'Password1',
        role: 'employer',
        company_code: '',
        company_name: 'Example Company',
        recaptcha_token: 'valid-test-token',
      }),
    });

    const response = await registerPost(request);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: 'A company code conflict occurred. Please try again.',
    });
    expect(mocks.deletedTables).toEqual(['employer_onboarding']);
    expect(mocks.admin.auth.admin.deleteUser).toHaveBeenCalledWith('new-employer');
  });
});

describe('verification resend response privacy', () => {
  it('returns the same generic response whether the account exists or not', async () => {
    const requestFor = () => new NextRequest('http://localhost/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'person@example.com',
        recaptcha_token: 'valid-test-token',
      }),
    });

    mocks.profileFound = true;
    const existingResponse = await resendVerificationPost(requestFor());
    const existingBody = await existingResponse.json();

    mocks.profileFound = false;
    const missingResponse = await resendVerificationPost(requestFor());
    const missingBody = await missingResponse.json();

    expect(existingResponse.status).toBe(200);
    expect(missingResponse.status).toBe(200);
    expect(existingBody).toEqual(missingBody);
    expect(existingBody).toEqual({
      message: 'If an unverified account exists for this email, a new verification link has been sent.',
    });
  });
});
