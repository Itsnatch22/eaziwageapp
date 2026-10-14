import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasRecentTotpVerification, requireRecentMfa } from '@/lib/server/recent-mfa';
import {
  getEmployerMfaEnrollmentRedirect,
  isEmployerMfaSetupApiAllowed,
  getAdminMfaEnrollmentRedirect,
  isAdminMfaSetupApiAllowed,
} from '@/lib/server/mfa-enforcement';

const mocks = vi.hoisted(() => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
      mfa: { getAuthenticatorAssuranceLevel: vi.fn() },
    },
  },
  createRouteHandlerClient: vi.fn(),
  checkRateLimit: vi.fn(),
  verifyCurrentPassword: vi.fn(),
  finishPasswordChange: vi.fn(),
}));

vi.mock('@/utils/supabase/server', () => ({
  createRouteHandlerClient: mocks.createRouteHandlerClient,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  mfaActionLimiter: {},
}));

vi.mock('@/lib/security-password', () => ({
  verifyCurrentPassword: mocks.verifyCurrentPassword,
  finishPasswordChange: mocks.finishPasswordChange,
}));

vi.mock('@/lib/api-errors', () => ({
  dbErrorResponse: vi.fn(() => Response.json({ error: 'Unexpected failure' }, { status: 500 })),
}));

import { PUT as employerPasswordPut } from '@/app/api/employer-dashboard/security/password/route';
import { PUT as employeePasswordPut } from '@/app/api/employee-dashboard/security/password/route';
import { PUT as adminPasswordPut } from '@/app/api/admin/security/password/route';
import { GET as adminMfaGet, POST as adminMfaPost } from '@/app/api/admin/security/mfa/route';

vi.mock('@/lib/mfa-handler', () => ({
  handleMfaGet: vi.fn(() => Response.json({ enabled: false })),
  handleMfaPost: vi.fn(() => Response.json({ success: true })),
}));

describe('recent TOTP verification helper', () => {
  const now = 1_800_000_000_000;

  it('accepts a recent TOTP AMR entry on an aal2 session', () => {
    expect(hasRecentTotpVerification({
      currentLevel: 'aal2',
      currentAuthenticationMethods: [{ method: 'totp', timestamp: now / 1000 - 30 }],
    }, now)).toBe(true);
    expect(hasRecentTotpVerification({
      currentLevel: 'aal2',
      currentAuthenticationMethods: [{ method: 'mfa/totp', timestamp: now / 1000 - 30 }],
    }, now)).toBe(true);
  });

  it('rejects aal1, non-TOTP, timestamp-less, and expired AMR entries', () => {
    expect(hasRecentTotpVerification({
      currentLevel: 'aal1',
      currentAuthenticationMethods: [{ method: 'totp', timestamp: now / 1000 }],
    }, now)).toBe(false);
    expect(hasRecentTotpVerification({
      currentLevel: 'aal2',
      currentAuthenticationMethods: ['otp'],
    }, now)).toBe(false);
    expect(hasRecentTotpVerification({
      currentLevel: 'aal2',
      currentAuthenticationMethods: [{ method: 'totp' }],
    }, now)).toBe(false);
    expect(hasRecentTotpVerification({
      currentLevel: 'aal2',
      currentAuthenticationMethods: [{ method: 'totp', timestamp: now / 1000 - 601 }],
    }, now)).toBe(false);
  });

  it('returns STEP_UP_REQUIRED when the current session has no recent TOTP', async () => {
    mocks.supabase.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', currentAuthenticationMethods: [{ method: 'password', timestamp: now / 1000 }] },
      error: null,
    });

    const response = await requireRecentMfa(mocks.supabase as unknown as SupabaseClient, 'user-1');
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({ code: 'STEP_UP_REQUIRED' });
  });
});

describe('employer MFA enrollment routing', () => {
  it('keeps the security settings tab reachable, preventing a redirect loop', () => {
    expect(getEmployerMfaEnrollmentRedirect('/dashboards/employer-dashboard/settings', 'security')).toBeNull();
  });

  it('sends other employer dashboard pages to the security tab', () => {
    expect(getEmployerMfaEnrollmentRedirect('/dashboards/employer-dashboard', null))
      .toBe('/dashboards/employer-dashboard/settings?tab=security');
    expect(getEmployerMfaEnrollmentRedirect('/dashboards/employer-dashboard/employees', null))
      .toBe('/dashboards/employer-dashboard/settings?tab=security');
  });

  it('does not redirect unrelated paths and permits only setup/session APIs', () => {
    expect(getEmployerMfaEnrollmentRedirect('/admin', null)).toBeNull();
    expect(isEmployerMfaSetupApiAllowed('/api/employer-dashboard/security/mfa')).toBe(true);
    expect(isEmployerMfaSetupApiAllowed('/api/employer-dashboard/security/sessions')).toBe(true);
    expect(isEmployerMfaSetupApiAllowed('/api/employer-dashboard/settings')).toBe(false);
  });

  it('keeps only admin MFA setup settings accessible before enrollment', () => {
    expect(getAdminMfaEnrollmentRedirect('/admin', null)).toBe('/admin/settings?tab=security');
    expect(getAdminMfaEnrollmentRedirect('/admin/users', null)).toBe('/admin/settings?tab=security');
    expect(getAdminMfaEnrollmentRedirect('/console', null)).toBe('/admin/settings?tab=security');
    expect(getAdminMfaEnrollmentRedirect('/admin/settings', 'security')).toBeNull();
    expect(getAdminMfaEnrollmentRedirect('/api/admin/security/mfa', null)).toBeNull();
    expect(isAdminMfaSetupApiAllowed('/api/admin/security/mfa')).toBe(true);
    expect(isAdminMfaSetupApiAllowed('/api/admin/settings/platform')).toBe(false);
  });
});

describe.each([
  ['employer', employerPasswordPut],
  ['employee', employeePasswordPut],
  ['admin', adminPasswordPut],
])('%s password-change route', (_role, handler) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createRouteHandlerClient.mockResolvedValue(mocks.supabase);
    mocks.supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'person@example.com' } },
      error: null,
    });
    mocks.supabase.auth.updateUser.mockResolvedValue({ error: null });
    mocks.checkRateLimit.mockResolvedValue({ success: true, headers: {} });
    mocks.verifyCurrentPassword.mockResolvedValue(true);
    mocks.finishPasswordChange.mockResolvedValue({ otherSessionsRevoked: true, auditLogged: true });
  });

  it('rejects requests without a current password before changing credentials', async () => {
    const request = new NextRequest('http://localhost/api/security/password', {
      method: 'PUT',
      body: JSON.stringify({ newPassword: 'correct horse battery' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await handler(request);

    expect(response.status).toBe(422);
    expect(mocks.verifyCurrentPassword).not.toHaveBeenCalled();
    expect(mocks.supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('verifies the supplied current password before updating and finishing the change', async () => {
    const request = new NextRequest('http://localhost/api/security/password', {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: 'current-pass',
        newPassword: 'correct horse battery',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await handler(request);

    expect(response.status).toBe(200);
    expect(mocks.verifyCurrentPassword).toHaveBeenCalledWith('person@example.com', 'current-pass');
    expect(mocks.supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'correct horse battery' });
    expect(mocks.finishPasswordChange).toHaveBeenCalledOnce();
  });
});

describe('admin MFA route', () => {
  it('uses the admin-specific rate-limit namespace and settings URL', async () => {
    const { handleMfaGet, handleMfaPost } = await import('@/lib/mfa-handler');
    const request = new NextRequest('http://localhost/api/admin/security/mfa');

    await adminMfaGet(request);
    await adminMfaPost(request);

    expect(handleMfaGet).toHaveBeenCalledWith(request, '-admin');
    expect(handleMfaPost).toHaveBeenCalledWith(
      request,
      '-admin',
      'EaziWage Admin Authenticator',
      expect.stringMatching(/\/admin\/settings\?tab=security$/),
    );
  });
});
