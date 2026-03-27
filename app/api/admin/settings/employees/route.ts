import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { checkAdminAccess } from '@/lib/server/admin-auth';

function createAdminClient() {
  const env = getEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function verifyAdmin(supabase: any, adminSupabase: any) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const access = await checkAdminAccess({ user, adminSupabase });
  if (!access.isAdmin) return null;

  return user;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();
    const user = await verifyAdmin(supabase, adminSupabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { data: employees, error } = await adminSupabase
      .from('employee_onboarding')
      .select(`
        id, full_name, email, status, risk_score, risk_level,
        employer:employer_onboarding!employer_id (
          company_name
        )
      `)
      .eq('status', 'approved');
      
    if (error) throw error;
    
    const formatted = (employees || []).map((emp) => {
      const employer = (emp as any).employer;
      const employerName = Array.isArray(employer)
        ? employer[0]?.company_name
        : employer?.company_name;

      return {
        ...emp,
        employer_name: employerName || 'Unlinked',
      };
    });
    
    return NextResponse.json(formatted);
  } catch (error) {
    console.error('[GET /api/admin/settings/employees] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
