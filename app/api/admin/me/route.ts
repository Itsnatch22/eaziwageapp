import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';

// Force dynamic so cookies() is evaluated per-request, never cached.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { user, adminSupabase } = auth;

  const [{ data: systemAdmin }, { data: profile }] = await Promise.all([
    adminSupabase
      .from('system_admins')
      .select('id, full_name, avatar_url, is_admin')
      .eq('id', user.id)
      .maybeSingle<{ id: string; full_name: string | null; avatar_url: string | null; is_admin: boolean }>(),
    adminSupabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url')
      .eq('id', user.id)
      .maybeSingle<{ id: string; email: string; full_name: string | null; role: string | null; avatar_url: string | null }>(),
  ]);

  const roleCandidates = [profile?.role, user.app_metadata?.role, user.user_metadata?.role]
    .filter((r): r is string => typeof r === 'string' && r.length > 0)
    .map((r) => r.toLowerCase());

  return NextResponse.json({
    user_id:           user.id,
    email:             user.email,
    full_name:         systemAdmin?.full_name ?? profile?.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    avatar_url:        systemAdmin?.avatar_url ?? profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
    profiles_role:     profile?.role ?? null,
    app_metadata_role: user.app_metadata?.role ?? null,
    user_metadata_role: user.user_metadata?.role ?? null,
    role_candidates:   roleCandidates,
    is_admin:          true,
    is_env_admin:      false,
    allowed_roles:     ['admin', 'super_admin', 'compliance', 'employer_admin'],
  });
}
