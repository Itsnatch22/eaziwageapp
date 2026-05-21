import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { checkAdminAccess } from '@/lib/server/admin-auth';

function createAdminClient() {
  const env = getEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function verifyAdmin(supabase: SupabaseClient, adminSupabase: SupabaseClient): Promise<User | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const access = await checkAdminAccess({ user, adminSupabase });
  if (!access.isAdmin) return null;

  return user;
}

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();
    const user = await verifyAdmin(supabase, adminSupabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { data: employers, error } = await adminSupabase
      .from('employer_onboarding')
      .select('id, company_name, status, country, risk_score')
      .eq('status', 'approved');
      
    if (error) throw error;
    return NextResponse.json(employers || []);
  } catch (error) {
    console.error('[GET /api/admin/settings/employers] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
