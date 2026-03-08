import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { isAdminRole, UserRoleEnum } from '@/lib/validations/kyc-validation';

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get('target_id');
    
    if (!targetId) {
      return NextResponse.json({ error: 'target_id is required' }, { status: 400 });
    }

    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify Admin Role
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !isAdminRole(profile.role as any)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: logs, error } = await adminSupabase
      .from('system_audit_logs')
      .select('*')
      .eq('target_id', targetId)
      .order('created_at', { ascending: false });

    if (error) {
      // If table doesn't exist yet, return empty array instead of 500
      if (error.code === 'PGRST116' || error.code === '42P01') {
        return NextResponse.json([]);
      }
      throw error;
    }

    return NextResponse.json(logs || []);
  } catch (error) {
    console.error('[GET /api/admin/audit] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
