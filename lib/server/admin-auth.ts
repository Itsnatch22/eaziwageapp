import type { SupabaseClient, User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isAdminRole, UserRoleEnum } from '@/lib/validations/kyc-validation';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { MFA_BACKUP_COOKIE, verifyMfaBackupCookie } from '@/lib/mfa-handler';

export type AdminContext = {
  user: User;
  adminSupabase: SupabaseClient;
};

export async function requireAdmin(): Promise<AdminContext | NextResponse<{ error: string }>> {
  const supabase = await createRouteHandlerClient();
  const adminSupabase = createAdminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await checkAdminAccess({ user, adminSupabase });
  if (access.error || !access.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { user, adminSupabase };
}

/**
 * Guards /console and its API routes. Requires: (1) a valid session, (2) the
 * single system_admins row flagged is_founder = true — a boolean column, not
 * an email string match, per the console spec — and (3) AAL2 already
 * satisfied for this session (TOTP, or the same bounded backup-code cookie
 * proxy.ts accepts — must agree with the shared gate, or a session let through
 * by proxy.ts via a valid backup-code cookie would get blocked again here).
 * proxy.ts enforces this for every dashboard/API route already, but this
 * route is unusually sensitive, so it re-checks here too rather than relying
 * solely on the shared gate.
 */
export async function requireFounder(): Promise<AdminContext | NextResponse<{ error: string }>> {
  const supabase = await createRouteHandlerClient();
  const adminSupabase = createAdminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaSatisfied = !(aalData?.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2')
    || verifyMfaBackupCookie((await cookies()).get(MFA_BACKUP_COOKIE)?.value, user.id);

  if (!mfaSatisfied) {
    return NextResponse.json({ error: 'MFA verification required' }, { status: 403 });
  }

  const { data: founderRow } = await adminSupabase
    .from('system_admins')
    .select('is_founder')
    .eq('id', user.id)
    .maybeSingle<{ is_founder: boolean }>();

  if (founderRow?.is_founder !== true) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { user, adminSupabase };
}

export interface AdminAccessResult {
  isAdmin: boolean;
  isSystemAdmin: boolean;
  roleCandidates: string[];
  error?: 'ROLE_CHECK_FAILED';
}

export async function checkAdminAccess(params: {
  user: User;
  adminSupabase: SupabaseClient;
}): Promise<AdminAccessResult> {
  const { user, adminSupabase } = params;

  const { data: systemAdmin } = await adminSupabase
    .from('system_admins')
    .select('id, is_admin')
    .eq('id', user.id)
    .maybeSingle<{ id: string; is_admin: boolean }>();
  const isSystemAdmin = systemAdmin?.is_admin === true;

  if (isSystemAdmin) {
    return {
      isAdmin: true,
      isSystemAdmin,
      roleCandidates: [],
    };
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string | null }>();

  if (profileError) {
    return {
      isAdmin: false,
      isSystemAdmin,
      roleCandidates: [],
      error: 'ROLE_CHECK_FAILED',
    };
  }

  const roleCandidates = [
    profile?.role,
    user.app_metadata?.role,
    user.user_metadata?.role,
  ]
    .filter((role): role is string => typeof role === 'string' && role.length > 0)
    .map((role) => role.toLowerCase());

  const isAdmin = roleCandidates.some((role) => {
    const parsed = UserRoleEnum.safeParse(role);
    return parsed.success && isAdminRole(parsed.data);
  });

  return {
    isAdmin,
    isSystemAdmin,
    roleCandidates,
  };
}
