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

    const { data: employer, error: employerError } = await adminSupabase
      .from('employer_onboarding')
      .select('id, company_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (employerError || !employer) {
      return NextResponse.json({ error: 'Employer record not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    const { error: deleteEmployerError } = await adminSupabase
      .from('employer_onboarding')
      .update({ deleted_at: now })
      .eq('id', employer.id);

    if (deleteEmployerError) throw deleteEmployerError;

    const { error: deleteEmployeesError } = await adminSupabase
      .from('employee_onboarding')
      .update({ status: 'rejected' }) 
      .eq('employer_id', employer.id);
    
    if (deleteEmployeesError) {
      console.error('[Termination] Failed to update employee_onboarding:', deleteEmployeesError);
    }
    
    const { error: deleteEmployeesTableError } = await adminSupabase
      .from('employees')
      .update({ deleted_at: now, status: 'Inactive' })
      .eq('employer_id', employer.id);

    if (deleteEmployeesTableError) {
      console.error('[Termination] Failed to update employees table (may not exist):', deleteEmployeesTableError);
    }

    await adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id,
      admin_name: user.email,
      target_id: employer.id,
      target_type: 'employer',
      action: 'account_termination_initiated',
      reason: 'User requested account deletion',
      metadata: { initiated_at: now }
    });

    return NextResponse.json({ success: true, message: 'Account termination initiated' });

  } catch (error: any) {
    console.error('[Termination API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
