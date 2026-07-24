import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/server/admin-auth';
import { notifyEmployee } from '@/lib/notifications';
import { dbErrorResponse } from '@/lib/api-errors';

export const runtime = 'nodejs';

const ReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  notes: z.string().max(500).optional(),
});

// Deliberately isolated from app/api/admin/kyc/documents/[id]/review/route.ts —
// this only ever updates the single payment_methods row being reviewed. It must
// never touch employee_onboarding.status or EWA settings.
export async function PATCH(
  req: NextRequest,
  { params }: IdRouteContext,
) {
  const rateLimitResponse = await checkAdminRateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { user, adminSupabase } = auth;

  const { id: paymentMethodId } = await params;

  const parsed = ReviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }
  const { status, notes } = parsed.data;

  // Re-fetch the payment method to get verification metadata and current state
  const { data: pm, error: pmError } = await adminSupabase
    .from('payment_methods')
    .select('id, employee_id, method_type, verification_status, provider_name, verification_document_path, verification_metadata, verification_document_hash')
    .eq('id', paymentMethodId)
    .maybeSingle();

  if (pmError) return dbErrorResponse('admin/payment-methods/review', pmError);
  if (!pm) return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
  if (pm.method_type !== 'bank_account') {
    return NextResponse.json({ error: 'This review flow only applies to bank accounts' }, { status: 400 });
  }

  // Idempotency: if it's already been reviewed, return current state
  if (pm.verification_status !== 'pending_review') {
    const { data: current } = await adminSupabase
      .from('payment_methods')
      .select('id, employee_id, is_verified, verification_status')
      .eq('id', paymentMethodId)
      .maybeSingle();
    return NextResponse.json({ success: true, message: 'Already reviewed', payment_method: current });
  }

  // Attempt to update only if still pending_review (guard against races)
  const { data: updated, error: updateError } = await adminSupabase
    .from('payment_methods')
    .update({
      verification_status: status,
      verification_notes: notes ?? null,
      is_verified: status === 'approved',
      verified_by: status === 'approved' ? user.id : null,
      verified_at: status === 'approved' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentMethodId)
    .eq('verification_status', 'pending_review')
    .select('id, employee_id, is_verified, verification_status')
    .single();

  if (updateError) {
    // If the update affected 0 rows due to race, fetch current and return success
    console.error('[admin/payment-methods/review] Update error:', updateError);
    const { data: current } = await adminSupabase
      .from('payment_methods')
      .select('id, employee_id, is_verified, verification_status')
      .eq('id', paymentMethodId)
      .maybeSingle();
    return NextResponse.json({ success: true, message: 'Concurrent update detected, returning current state', payment_method: current });
  }

  // Record verification audit for traceability
  try {
    await adminSupabase.from('payment_method_verification_audit').insert({
      payment_method_id: paymentMethodId,
      admin_id: user.id,
      action: status === 'approved' ? 'approved' : 'rejected',
      notes: notes ?? null,
      checksum: pm.verification_document_hash ?? (pm.verification_metadata?.checksum ?? null),
      document_path: pm.verification_document_path ?? null,
    });
  } catch (auditErr) {
    console.error('[admin/payment-methods/review] Failed to write verification audit:', auditErr);
    // don't fail the whole request for audit write failures, but log
  }

  const { data: employee } = await adminSupabase
    .from('employees')
    .select('user_id')
    .eq('id', pm.employee_id)
    .maybeSingle();

  if (employee?.user_id) {
    await notifyEmployee({
      userId: employee.user_id,
      type: 'system_alert',
      title: status === 'approved' ? 'Bank Account Verified' : 'Bank Account Verification Rejected',
      message: status === 'approved'
        ? `Your ${pm.provider_name} bank account has been verified and can now be used for withdrawals.`
        : `Your ${pm.provider_name} bank account verification was rejected.${notes ? ` Reason: ${notes}` : ''}`,
    });
  }

  void adminSupabase.from('system_audit_logs').insert({
    admin_id: user.id,
    admin_name: user.email,
    target_id: paymentMethodId,
    target_type: 'payment_method',
    action: `bank_verification_${status}`,
    new_value: { verification_status: status, notes: notes || null },
  });

  return NextResponse.json({ success: true, payment_method: updated });
}
