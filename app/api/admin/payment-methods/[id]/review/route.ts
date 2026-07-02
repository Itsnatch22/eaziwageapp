import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/server/admin-auth';
import { notifyEmployee } from '@/lib/notifications';

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

  const { data: pm, error: pmError } = await adminSupabase
    .from('payment_methods')
    .select('id, employee_id, method_type, verification_status, provider_name')
    .eq('id', paymentMethodId)
    .maybeSingle();

  if (pmError) return NextResponse.json({ error: pmError.message }, { status: 500 });
  if (!pm) return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
  if (pm.method_type !== 'bank_account') {
    return NextResponse.json({ error: 'This review flow only applies to bank accounts' }, { status: 400 });
  }
  if (pm.verification_status !== 'pending_review') {
    return NextResponse.json({ error: `Payment method is not pending review (current: ${pm.verification_status})` }, { status: 422 });
  }

  const { data: updated, error: updateError } = await adminSupabase
    .from('payment_methods')
    .update({
      verification_status: status,
      verification_notes: notes ?? null,
      is_verified: status === 'approved',
      verified_by: user.id,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentMethodId)
    .select('id, employee_id, is_verified, verification_status')
    .single();

  if (updateError) {
    console.error('[admin/payment-methods/review] Update error:', updateError);
    return NextResponse.json({ error: 'Failed to update payment method' }, { status: 500 });
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
