import { NextRequest, NextResponse } from 'next/server';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/server/admin-auth';
import { ReviewRequestPatchSchema } from '@/lib/validations/route-schemas';
import { notifyEmployer, notifyEmployee } from '@/lib/notifications';
import { dbErrorResponse } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PATCH(
  req: NextRequest,
  { params }: IdRouteContext
) {
  const rateLimitResponse = await checkAdminRateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;

  const { id: requestId } = await params;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { adminSupabase, user: adminUser } = auth;

  const raw = await req.json().catch(() => null);
  const rrParsed = ReviewRequestPatchSchema.safeParse(raw);
  if (!rrParsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: rrParsed.error.issues },
      { status: 422 },
    );
  }
  const { status, response, internal_notes, type } = rrParsed.data;

  if (type === 'risk_score') {
    const { data: request, error: updateError } = await adminSupabase
      .from('risk_review_requests')
      .update({
        status,
        internal_notes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUser.id,
      })
      .eq('id', requestId)
      .select('*, employer_onboarding(user_id)')
      .single();

    if (updateError) {
      return dbErrorResponse('admin/review-requests/risk_score', updateError);
    }

    if (request.employer_onboarding?.user_id) {
      await notifyEmployer({
        userId: request.employer_onboarding.user_id,
        type: 'kyc_update',
        title: `Risk Review ${status === 'approved' ? 'Completed' : 'Rejected'}`,
        message:
          status === 'approved'
            ? 'Your risk profile has been reviewed and approved.'
            : `Your risk review was rejected. ${response || internal_notes ? `Notes: ${response || internal_notes}` : ''}`,
      });
    }

    void adminSupabase.from('system_audit_logs').insert({
      admin_id: adminUser.id,
      admin_name: adminUser.email,
      target_id: requestId,
      target_type: 'risk_review_request',
      action: 'risk_review_resolved',
      old_value: null,
      new_value: { status },
      metadata: { internal_notes },
    }).then(({ error }) => { if (error) console.error('[audit] risk_review_resolved:', error); });

    return NextResponse.json({ message: 'Request updated successfully', data: request });
  }

  if (type === 'kyc_review') {
    const { data: document, error: updateError } = await adminSupabase
      .from('employee_kyc_documents')
      .update({
        status,
        reviewer_notes: response || internal_notes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUser.id,
      })
      .eq('id', requestId)
      .select('id, user_id, document_type, status, reviewer_notes, reviewed_at, reviewed_by, created_at, updated_at')
      .single();

    if (updateError) {
      return dbErrorResponse('admin/review-requests/kyc_review', updateError);
    }

    if (document.user_id) {
      await notifyEmployee({
        userId: document.user_id,
        type: 'kyc_update',
        title: `KYC Document ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Your ${document.document_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} has been ${status}.${response || internal_notes ? ` Notes: ${response || internal_notes}` : ''}`,
      });
    }

    void adminSupabase.from('system_audit_logs').insert({
      admin_id: adminUser.id,
      admin_name: adminUser.email,
      target_id: requestId,
      target_type: 'kyc_document',
      action: `kyc_review_${status}`,
      old_value: null,
      new_value: { status },
      metadata: { reviewer_notes: response || internal_notes },
    }).then(({ error }) => { if (error) console.error('[audit] kyc_review_resolved:', error); });

    return NextResponse.json({ message: 'Request updated successfully', data: document });
  }

  if (type === 'payment_method_change') {
    const { data: request, error: fetchError } = await adminSupabase
      .from('payment_method_change_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (status === 'approved') {
      const updatePayload: Record<string, unknown> = {
        provider_name: request.new_provider_name,
        account_name: request.new_account_name ?? null,
        account_number: request.new_account_number ?? null,
        phone_number: request.new_phone_number ?? null,
        method_type: request.requested_method_type,
        updated_at: new Date().toISOString(),
      };

      const { error: paymentMethodUpdateError } = await adminSupabase
        .from('payment_methods')
        .update(updatePayload)
        .eq('id', request.payment_method_id)
        .eq('employee_id', request.employee_id);

      if (paymentMethodUpdateError) {
        return dbErrorResponse('admin/review-requests/payment_method_change', paymentMethodUpdateError);
      }
    }

    const { data: updatedRequest, error: updateError } = await adminSupabase
      .from('payment_method_change_requests')
      .update({
        status,
        internal_notes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUser.id,
      })
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) {
      return dbErrorResponse('admin/review-requests/payment_method_change', updateError);
    }

    const { data: employeeRow } = await adminSupabase
      .from('employees')
      .select('user_id')
      .eq('id', request.employee_id)
      .maybeSingle();

    if (employeeRow?.user_id) {
      await notifyEmployee({
        userId: employeeRow.user_id,
        type: 'kyc_update',
        title: `Payment Method Change ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message: status === 'approved'
          ? 'Your payment method change request was approved.'
          : `Your payment method change request was rejected.${response ? ` Reason: ${response}` : ''}`,
      });
    }

    void adminSupabase.from('system_audit_logs').insert({
      admin_id: adminUser.id,
      admin_name: adminUser.email,
      target_id: requestId,
      target_type: 'payment_method_change_request',
      action: `payment_method_change_${status}`,
      old_value: null,
      new_value: { status },
      metadata: { payment_method_id: request.payment_method_id, reason: response || internal_notes },
    }).then(({ error }) => { if (error) console.error('[audit] payment_method_change_resolved:', error); });

    return NextResponse.json({ message: 'Request updated successfully', data: updatedRequest });
  }

  if (type === 'bank_change') {
    const { data: bRequest, error: fetchError } = await adminSupabase
      .from('bank_change_requests')
      .select('id, employer_id, user_id, current_bank_name, current_account_number, new_bank_name, new_account_number, status')
      .eq('id', requestId)
      .single();

    if (fetchError || !bRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (status === 'approved') {
      const bankUpdate = {
        bank_name: bRequest.new_bank_name,
        bank_account_number: bRequest.new_account_number,
        updated_at: new Date().toISOString(),
      };

      await Promise.all([
        adminSupabase.from('employer_onboarding').update(bankUpdate).eq('id', bRequest.employer_id),
        adminSupabase.from('employers').update(bankUpdate).eq('onboarding_id', bRequest.employer_id),
      ]);
    }

    const { data: updatedRequest, error: updateError } = await adminSupabase
      .from('bank_change_requests')
      .update({
        status,
        internal_notes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUser.id,
      })
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) {
      return dbErrorResponse('admin/review-requests/bank_change', updateError);
    }

    if (bRequest.user_id) {
      await notifyEmployer({
        userId: bRequest.user_id,
        type: 'bank_change_outcome',
        title: `Bank Details Change ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message:
          status === 'approved'
            ? 'Your request to change bank details has been approved and updated.'
            : `Your bank details change request was rejected.${response ? ` Reason: ${response}` : ''}`,
        metadata: {
          outcome: status === 'approved' ? 'approved' : 'rejected',
          requestedBankName: bRequest.new_bank_name ?? 'New Bank',
          // Store only last-4 mask — full account number must never be persisted in notification rows
          requestedAccountNumber: bRequest.new_account_number && bRequest.new_account_number.length > 4
            ? `•••• ${bRequest.new_account_number.slice(-4)}`
            : '••••••••',
          currentBankName: bRequest.current_bank_name ?? undefined,
          reason: response || internal_notes || undefined,
          effectiveAt: new Date().toLocaleString(),
        },
      });
    }

    const maskAccount = (n: string | null | undefined) =>
      n && n.length > 4 ? `•••• ${n.slice(-4)}` : '••••••••';

    void adminSupabase.from('system_audit_logs').insert({
      admin_id: adminUser.id,
      admin_name: adminUser.email,
      target_id: requestId,
      target_type: 'bank_change_request',
      action: `bank_change_${status}`,
      old_value: { bank_name: bRequest.current_bank_name, account_number: maskAccount(bRequest.current_account_number) },
      new_value: status === 'approved' ? { bank_name: bRequest.new_bank_name, account_number: maskAccount(bRequest.new_account_number) } : null,
      metadata: { employer_id: bRequest.employer_id, reason: response || internal_notes },
    }).then(({ error }) => { if (error) console.error('[audit] bank_change_resolved:', error); });

    return NextResponse.json({ message: 'Request updated successfully', data: updatedRequest });
  }

  return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
}
