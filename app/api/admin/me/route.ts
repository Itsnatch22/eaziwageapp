import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';

export async function GET(): Promise<NextResponse> {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const env = getEnv();
  const adminSupabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [systemAdminResult, profileResult] = await Promise.all([
    adminSupabase
      .from('system_admins')
      .select('id, email, full_name, avatar_url, is_admin')
      .eq('id', user.id)
      .maybeSingle<{ id: string; email: string; full_name: string | null; avatar_url: string | null; is_admin: boolean }>(),
    adminSupabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url')
      .eq('id', user.id)
      .maybeSingle<{ id: string; email: string; full_name: string | null; role: string | null; avatar_url: string | null }>(),
  ]);

  const systemAdminRecord = systemAdminResult.data;
  const profile = profileResult.data;
  const isSystemAdmin = systemAdminRecord?.is_admin === true;

  if (isSystemAdmin) {
    return NextResponse.json({
      user_id: user.id,
      email: user.email,
      full_name: systemAdminRecord?.full_name ?? profile?.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      avatar_url: systemAdminRecord?.avatar_url ?? profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
      profiles_role: profile?.role ?? null,
      app_metadata_role: user.app_metadata?.role ?? null,
      user_metadata_role: user.user_metadata?.role ?? null,
      role_candidates: ['admin'],
      is_admin: true,
      is_env_admin: false,
      allowed_roles: ['admin', 'super_admin', 'compliance', 'employer_admin'],
    });
  }

  const roleCandidates = [profile?.role, user.app_metadata?.role, user.user_metadata?.role]
    .filter((r): r is string => typeof r === 'string' && r.length > 0)
    .map((r) => r.toLowerCase());

  const allowedRoles = ['admin', 'super_admin', 'compliance', 'employer_admin'];
  const isAdminRoleFinal = roleCandidates.some((role) => allowedRoles.includes(role));

  return NextResponse.json({
    user_id: user.id,
    email: user.email,
    full_name: profile?.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    avatar_url: profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
    profiles_role: profile?.role ?? null,
    app_metadata_role: user.app_metadata?.role ?? null,
    user_metadata_role: user.user_metadata?.role ?? null,
    role_candidates: roleCandidates,
    is_admin: isAdminRoleFinal,
    is_env_admin: false,
    allowed_roles: ['admin', 'super_admin', 'compliance', 'employer_admin'],
  });
}