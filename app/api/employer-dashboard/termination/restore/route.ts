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

    const { error: restoreEmployerError } = await adminSupabase
      .from('employer_onboarding')
      .update({ deleted_at: null })
      .eq('id', employer.onboarding_id);

    if (restoreEmployerError) throw restoreEmployerError;

    const { data: restoredEmployees } = await adminSupabase
      .from('employees')
      .update({ deleted_at: null, status: 'Active' })
      .eq('employer_id', employer.id)
      .select('user_id');

    // Don't blanket-claim every restored employee's KYC is 'approved' — that's
    // simply false for anyone who was legitimately rejected or never finished
    // submitting documents before termination. Instead, force
    // trg_recompute_onboarding_status to re-derive each employee's real status
    // from their actual employee_kyc_documents rows: Postgres fires an
    // `AFTER UPDATE OF status` trigger whenever the column is named in the SET
    // list, even when the value is unchanged, so this self-update is a safe,
    // no-op-at-the-data-level way to trigger a fresh, accurate recompute.
    // (An employee with zero submitted documents has no employee_kyc_documents
    // rows to touch here, so their status stays whatever termination left it —
    // a known edge case, not solved by this technique.)
    const restoredUserIds = (restoredEmployees ?? [])
      .map((e) => e.user_id)
      .filter((id): id is string => Boolean(id));

    if (restoredUserIds.length > 0) {
      const { data: docsToRecompute } = await adminSupabase
        .from('employee_kyc_documents')
        .select('id, status')
        .in('user_id', restoredUserIds);

      await Promise.allSettled(
        (docsToRecompute ?? []).map((doc) =>
          adminSupabase
            .from('employee_kyc_documents')
            .update({ status: doc.status })
            .eq('id', doc.id),
        ),
      );
    }

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

  } catch (error: unknown) {
    console.error('[Restore API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
