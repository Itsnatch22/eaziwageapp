import { NextRequest, NextResponse } from 'next/server';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { EmployeeKycPatchSchema } from '@/lib/validations/route-schemas';
import { requireAdmin } from '@/lib/server/admin-auth';
import { notifyEmployee } from '@/lib/notifications';
import { activateUser, deactivateUser } from '@/lib/activation';

export async function PATCH(
  req: NextRequest,
  { params }: IdRouteContext
) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    const raw = await req.json().catch(() => null);
    const kycParsed = EmployeeKycPatchSchema.safeParse(raw);
    if (!kycParsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: kycParsed.error.issues },
        { status: 422 },
      );
    }
    const { kyc_status, reason } = kycParsed.data;

    // Previously this route checked only profiles.role via isAdminRole(), ignoring
    // system_admins — a legitimate system_admins-only admin (no profiles.role set)
    // got wrongly 403'd. requireAdmin() checks system_admins first, falling back
    // to profiles.role, matching the pattern used by every other admin route.
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;

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

    // profiles.is_active is the only thing proxy.ts checks to let a user into their
    // dashboard — this route told the employee "your account is now being activated"
    // but never actually called activateUser(), so an employee approved through this
    // route stayed locked out of their own dashboard despite the message.
    if (kyc_status === 'approved') {
      const activationResult = await activateUser(id);
      if (!activationResult.success) {
        console.error('[PATCH /api/admin/employees/[id]/kyc] Failed to activate user:', activationResult.error);
      }
    } else if (kyc_status === 'rejected') {
      const deactivationResult = await deactivateUser(id);
      if (!deactivationResult.success) {
        console.error('[PATCH /api/admin/employees/[id]/kyc] Failed to deactivate user:', deactivationResult.error);
      }
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

    return NextResponse.json({ success: true, message: `KYC status updated to ${kyc_status}` });
  } catch (error) {
    console.error('[PATCH /api/admin/employees/[id]/kyc] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
