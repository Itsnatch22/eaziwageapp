import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';

vi.mock('@/lib/mfa-handler', () => ({
  MFA_BACKUP_COOKIE: 'mfa-backup',
  verifyMfaBackupCookie: vi.fn(),
  DEVICE_TRUST_COOKIE: 'device-trust',
  verifyDeviceTrustCookie: vi.fn(),
}));

import { checkAdminAccess } from '@/lib/server/admin-auth';

function createAdminSupabase(profileRole: string | null) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === 'system_admins'
              ? null
              : { role: profileRole },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('checkAdminAccess', () => {
  it('does not treat user-editable metadata as an admin role', async () => {
    const result = await checkAdminAccess({
      user: {
        id: 'user-1',
        aud: 'authenticated',
        created_at: '2026-10-24T00:00:00.000Z',
        app_metadata: {},
        user_metadata: { role: 'admin' },
      } as User,
      adminSupabase: createAdminSupabase('employee'),
    });

    expect(result.isAdmin).toBe(false);
    expect(result.roleCandidates).toEqual(['employee']);
  });

  it('continues to accept a trusted profile admin role', async () => {
    const result = await checkAdminAccess({
      user: {
        id: 'user-1',
        aud: 'authenticated',
        created_at: '2026-10-24T00:00:00.000Z',
        app_metadata: {},
        user_metadata: {},
      } as User,
      adminSupabase: createAdminSupabase('admin'),
    });

    expect(result.isAdmin).toBe(true);
    expect(result.roleCandidates).toEqual(['admin']);
  });
});
