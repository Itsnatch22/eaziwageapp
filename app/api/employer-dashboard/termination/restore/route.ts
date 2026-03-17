import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get Employer Record (even if deleted_at is set)
    const { data: employer, error: employerError } = await adminSupabase
      .from('employer_onboarding')
      .select('id, company_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (employerError || !employer) {
      return NextResponse.json({ error: 'Employer record not found' }, { status: 404 });
    }

    // 2. Restore Employer
    const { error: restoreEmployerError } = await adminSupabase
      .from('employer_onboarding')
      .update({ deleted_at: null })
      .eq('id', employer.id);

    if (restoreEmployerError) throw restoreEmployerError;

    // 3. Restore linked Employees
    await adminSupabase
      .from('employee_onboarding')
      .update({ status: 'approved' }) 
      .eq('employer_id', employer.id);
    
    await adminSupabase
      .from('employees')
      .update({ deleted_at: null, status: 'Active' })
      .eq('employer_id', employer.id);

    // 4. Log the activity
    await adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id,
      admin_name: user.email,
      target_id: employer.id,
      target_type: 'employer',
      action: 'account_restored',
      reason: 'User restored account during grace period',
      metadata: { restored_at: new Date().toISOString() }
    });

    return NextResponse.json({ success: true, message: 'Account restored successfully' });

  } catch (error: any) {
    console.error('[Restore API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
