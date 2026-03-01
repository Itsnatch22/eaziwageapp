// app/api/admin/me/route.ts
// GET /api/admin/me
//
// Development diagnostic: returns the current session's role info.
// Safe to call from the browser to see exactly what the route sees.
//
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { getEnv } from '@/env';
import { isAdminRole, UserRoleEnum } from '@/lib/validations/kyc-validation';
import { createRouteHandlerClient } from '@/utils/supabase/server';

export async function GET(_req: NextRequest): Promise<NextResponse> {
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

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string | null }>();

  const roleCandidates = [profile?.role, user.app_metadata?.role, user.user_metadata?.role]
    .filter((r): r is string => typeof r === 'string' && r.length > 0)
    .map((r) => r.toLowerCase());

  return NextResponse.json({
    user_id: user.id,
    email: user.email,
    profiles_role: profile?.role ?? null,
    app_metadata_role: user.app_metadata?.role ?? null,
    user_metadata_role: user.user_metadata?.role ?? null,
    role_candidates: roleCandidates,
    is_admin: roleCandidates.some((role) => {
      const parsed = UserRoleEnum.safeParse(role);
      return parsed.success && isAdminRole(parsed.data);
    }),
    allowed_roles: ['admin', 'super_admin', 'compliance', 'employer_admin'],
  });
}

