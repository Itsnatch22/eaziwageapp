import { NextRequest, NextResponse } from 'next/server';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/server/admin-auth';
import { notifyEmployer, notifyEmployee } from '@/lib/notifications';

interface ReviewRequestPayload {
  status: string;
  response?: string;
  internal_notes?: string;
  type?: string;
}

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

  let body: ReviewRequestPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { status, response, internal_notes, type } = body;

  if (!type) {
    return NextResponse.json({ error: 'Missing request type' }, { status: 400 });
  }

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
      console.error('[PATCH review-requests/[id]] risk_score update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
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
      .select('*')
      .single();

    if (updateError) {
      console.error('[PATCH review-requests/[id]] kyc_review update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (document.user_id) {
      await notifyEmployee({
        userId: document.user_id,
        type: 'kyc_update',
        title: `KYC Document ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Your ${document.document_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} has been ${status}.${response || internal_notes ? ` Notes: ${response || internal_notes}` : ''}`,
      });
    }

    return NextResponse.json({ message: 'Request updated successfully', data: document });
  }

  if (type === 'bank_change') {
    const { data: bRequest, error: fetchError } = await adminSupabase
      .from('bank_change_requests')
      .select('*')
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
      console.error('[PATCH review-requests/[id]] bank_change update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
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
          requestedAccountNumber: bRequest.new_account_number ?? '••••••••',
          currentBankName: bRequest.current_bank_name ?? undefined,
          reason: response || internal_notes || undefined,
          effectiveAt: new Date().toLocaleString(),
        },
      });
    }

    return NextResponse.json({ message: 'Request updated successfully', data: updatedRequest });
  }

  return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
}
