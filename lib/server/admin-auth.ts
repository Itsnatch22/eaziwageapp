import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { isAdminRole, UserRoleEnum } from '@/lib/validations/kyc-validation';

export interface AdminAccessResult {
  isAdmin: boolean;
  isEnvAdmin: boolean;
  isSystemAdmin: boolean;
  roleCandidates: string[];
  error?: 'ROLE_CHECK_FAILED';
}

function normalizeEmails(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .replace(/^"|"$/g, '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function checkAdminAccess(params: {
  user: User;
  adminSupabase: SupabaseClient;
}): Promise<AdminAccessResult> {
  const { user, adminSupabase } = params;
  const env = getEnv();

  const adminEmails = normalizeEmails(env.ADMIN_EMAILS);
  const isEnvAdmin = adminEmails.includes(user.email?.toLowerCase() ?? '');

  let isSystemAdmin = false;
  const { data: systemAdmin } = await adminSupabase
    .from('system_admins')
    .select('id, is_admin')
    .eq('id', user.id)
    .maybeSingle<{ id: string; is_admin: boolean }>();
  isSystemAdmin = systemAdmin?.is_admin === true;

  if (isEnvAdmin || isSystemAdmin) {
    return {
      isAdmin: true,
      isEnvAdmin,
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
      isEnvAdmin,
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
    isEnvAdmin,
    isSystemAdmin,
    roleCandidates,
  };
}
