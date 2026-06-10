import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { isAdminRole, UserRole } from '@/lib/validations/kyc-validation';
import { notifyEmployee } from '@/lib/notifications';

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { kyc_status, reason } = await req.json();
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !isAdminRole(profile.role as UserRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: updateError } = await adminSupabase
      .from('employee_onboarding')
      .update({ 
        status: kyc_status,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', id);

    if (updateError) {
      console.error('[PATCH kyc] update error:', updateError);
      return NextResponse.json({ error: 'Failed to update KYC status' }, { status: 500 });
    }

    if (kyc_status === 'approved') {
      await adminSupabase
        .from('employee_kyc_documents')
        .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user.id })
        .eq('user_id', id);
    } else if (kyc_status === 'rejected') {
      await adminSupabase
        .from('employee_kyc_documents')
        .update({ status: 'rejected', reviewer_notes: reason, reviewed_at: new Date().toISOString(), reviewed_by: user.id })
        .eq('user_id', id)
        .eq('status', 'pending');
    }

    const title = kyc_status === 'approved' ? 'KYC Verification Approved' : 'KYC Verification Rejected';
    const message = kyc_status === 'approved' 
      ? 'Your identity documents have been verified successfully. Your account is now being activated.' 
      : `Your identity verification was rejected. Reason: ${reason || 'Documents are unclear or invalid'}. Please re-upload.`;

    await notifyEmployee({
      userId: id,
      type: 'kyc_update',
      title,
      message,
    });

    const { data: adminProfile } = await adminSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    await adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id,
      admin_name: adminProfile?.full_name || 'Admin',
      target_id: id,
      target_type: 'employee',
      action: 'kyc_review',
      new_status: kyc_status,
      reason: reason || null,
      created_at: new Date().toISOString(),
    });

    // Pusher triggers removed; Supabase Realtime handles KYC update notifications via DB changes.

    return NextResponse.json({ success: true, message: `KYC status updated to ${kyc_status}` });
  } catch (error) {
    console.error('[PATCH /api/admin/employees/[id]/kyc] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
