import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      mfa: {
        listFactors: vi.fn(),
        unenroll: vi.fn(),
      },
    },
  },
  createRouteHandlerClient: vi.fn(),
  checkRateLimit: vi.fn(),
  requireRecentMfa: vi.fn(),
  createAdminClient: vi.fn(),
  sendMfaDisabledEmail: vi.fn(),
}));

vi.mock('@/utils/supabase/server', () => ({
  createRouteHandlerClient: mocks.createRouteHandlerClient,
}));

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  mfaActionLimiter: {},
  mfaVerifyLimiter: {},
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock('@/lib/server/recent-mfa', () => ({
  requireRecentMfa: mocks.requireRecentMfa,
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock('@/lib/security-alerts', () => ({
  sendMfaDisabledEmail: mocks.sendMfaDisabledEmail,
}));

import { handleMfaPost } from '@/lib/mfa-handler';

describe('MFA disable step-up', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createRouteHandlerClient.mockResolvedValue(mocks.supabase);
    mocks.supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1', email: 'admin@example.com', user_metadata: {} } },
      error: null,
    });
    mocks.checkRateLimit.mockResolvedValue({ success: true, headers: {} });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
      })),
    });
    mocks.sendMfaDisabledEmail.mockResolvedValue(undefined);
    mocks.requireRecentMfa.mockResolvedValue(
      Response.json({ error: 'Recent TOTP verification required', code: 'STEP_UP_REQUIRED' }, { status: 403 }),
    );
  });

  it('requires recent TOTP even when no route-specific key prefix is supplied', async () => {
    const request = new NextRequest('http://localhost/api/admin/security/mfa', {
      method: 'POST',
      body: JSON.stringify({ action: 'disable' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await handleMfaPost(request, '', 'Admin Authenticator');

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'STEP_UP_REQUIRED' });
    expect(mocks.requireRecentMfa).toHaveBeenCalledWith(mocks.supabase, 'admin-1');
    expect(mocks.supabase.auth.mfa.listFactors).not.toHaveBeenCalled();
    expect(mocks.sendMfaDisabledEmail).not.toHaveBeenCalled();
  });

  it('sends the disable alert after a successful removal even without a route prefix', async () => {
    mocks.requireRecentMfa.mockResolvedValue(null);
    mocks.supabase.auth.mfa.listFactors.mockResolvedValue({
      data: { all: [{ id: 'factor-1', factor_type: 'totp' }] },
      error: null,
    });
    mocks.supabase.auth.mfa.unenroll.mockResolvedValue({ error: null });
    const request = new NextRequest('http://localhost/api/admin/security/mfa', {
      method: 'POST',
      body: JSON.stringify({ action: 'disable', factorId: 'factor-1' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await handleMfaPost(request, '', 'Admin Authenticator', 'https://app.example/admin/settings?tab=security');

    expect(response.status).toBe(200);
    expect(mocks.sendMfaDisabledEmail).toHaveBeenCalledWith(
      'admin@example.com',
      'admin@example.com',
      'https://app.example/admin/settings?tab=security',
    );
  });
});
