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

    if (kyc_status === 'rejected' && !reason?.trim()) {
      return NextResponse.json(
        { error: 'A reason is required when rejecting KYC.' },
        { status: 422 },
      );
    }

    // Previously this route checked only profiles.role via isAdminRole(), ignoring
    // system_admins — a legitimate system_admins-only admin (no profiles.role set)
    // got wrongly 403'd. requireAdmin() checks system_admins first, falling back
    // to profiles.role, matching the pattern used by every other admin route.
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;

    // No direct employee_onboarding.status write here — bulk-updating
    // employee_kyc_documents below (which this route already did) fires
    // trg_recompute_onboarding_status and derives the correct rollup status
    // itself. Writing status here too used to race with that trigger.
    if (kyc_status === 'approved') {
      const { error: docsError } = await adminSupabase
        .from('employee_kyc_documents')
        .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user.id })
        .eq('user_id', id);

      if (docsError) {
        console.error('[PATCH kyc] documents update error:', docsError);
        return NextResponse.json({ error: 'Failed to update KYC status' }, { status: 500 });
      }
    } else if (kyc_status === 'rejected') {
      const { error: docsError } = await adminSupabase
        .from('employee_kyc_documents')
        .update({ status: 'rejected', reviewer_notes: reason, reviewed_at: new Date().toISOString(), reviewed_by: user.id })
        .eq('user_id', id)
        .eq('status', 'pending');

      if (docsError) {
        console.error('[PATCH kyc] documents update error:', docsError);
        return NextResponse.json({ error: 'Failed to update KYC status' }, { status: 500 });
      }
    } else if (kyc_status === 'pending') {
      // Same "back in the review queue" semantics as the analogous branch in
      // app/api/admin/employees/[id]/status/route.ts — resets every document
      // to pending, and the trigger derives 'pending' or 'under_review' from
      // however many are actually submitted.
      const { error: docsError } = await adminSupabase
        .from('employee_kyc_documents')
        .update({ status: 'pending' })
        .eq('user_id', id);

      if (docsError) {
        console.error('[PATCH kyc] documents update error:', docsError);
        return NextResponse.json({ error: 'Failed to update KYC status' }, { status: 500 });
      }
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
    } else if (kyc_status === 'rejected' || kyc_status === 'pending') {
      const deactivationResult = await deactivateUser(id);
      if (!deactivationResult.success) {
        console.error('[PATCH /api/admin/employees/[id]/kyc] Failed to deactivate user:', deactivationResult.error);
      }
    }

    const title =
      kyc_status === 'approved' ? 'KYC Verification Approved'
      : kyc_status === 'rejected' ? 'KYC Verification Rejected'
      : 'KYC Under Review';
    const message =
      kyc_status === 'approved' ? 'Your identity documents have been verified successfully. Your account is now being activated.'
      : kyc_status === 'rejected' ? `Your identity verification was rejected. Reason: ${reason || 'Documents are unclear or invalid'}. Please re-upload.`
      : 'Your KYC application has been moved back into the review queue.';

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
