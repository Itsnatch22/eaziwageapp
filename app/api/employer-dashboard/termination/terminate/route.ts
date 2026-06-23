import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function POST() {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: employer, error: employerError } = await adminSupabase
      .from('employers')
      .select('id, onboarding_id, company_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (employerError || !employer) {
      return NextResponse.json({ error: 'Employer record not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Fetch all employee user_ids before marking them inactive
    const { data: activeEmployees } = await adminSupabase
      .from('employees')
      .select('user_id')
      .eq('employer_id', employer.id)
      .is('deleted_at', null);

    // Soft-delete employer_onboarding
    const { error: deleteEmployerError } = await adminSupabase
      .from('employer_onboarding')
      .update({ deleted_at: now })
      .eq('id', employer.onboarding_id);

    if (deleteEmployerError) throw deleteEmployerError;

    // Reject all pending employee KYC applications
    await adminSupabase
      .from('employee_onboarding')
      .update({ status: 'rejected' })
      .eq('employer_id', employer.onboarding_id);

    // Soft-delete all employees
    await adminSupabase
      .from('employees')
      .update({ deleted_at: now, status: 'Inactive' })
      .eq('employer_id', employer.id);

    // Revoke Supabase sessions for every employee — they get logged out immediately
    if (activeEmployees && activeEmployees.length > 0) {
      await Promise.allSettled(
        activeEmployees.map(({ user_id }) =>
          adminSupabase.auth.admin.signOut(user_id, 'global'),
        ),
      );
    }

    await adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id,
      admin_name: user.email,
      target_id: employer.id,
      target_type: 'employer',
      action: 'account_termination_initiated',
      reason: 'Employer requested account deletion',
      metadata: {
        initiated_at: now,
        employees_signed_out: activeEmployees?.length ?? 0,
        company_name: employer.company_name,
      },
    });

    // Sign out the employer themselves last
    await supabase.auth.signOut();

    return NextResponse.json({ success: true, message: 'Account terminated. All employees have been logged out.' });

  } catch (error: unknown) {
    console.error('[Termination API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
