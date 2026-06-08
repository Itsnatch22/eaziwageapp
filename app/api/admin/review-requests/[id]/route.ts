import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { UserRoleEnum, isAdminRole } from '@/lib/validations/kyc-validation';
import pusherServer from '@/lib/pusher-server';

interface ReviewRequestPayload {
  status: string;
  response?: string;
  internal_notes?: string;
  type?: string;
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function createAdminClient() {
  const env = getEnv();
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function verifyAdmin() {
  const supabase = await createRouteHandlerClient();
  const adminSupabase = createAdminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized', status: 401 };

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const roles = [profile?.role, user.app_metadata?.role, user.user_metadata?.role]
    .filter((role): role is string => typeof role === 'string' && role.length > 0)
    .map((role) => role.toLowerCase());

  if (!roles.some((role) => {
    const parsed = UserRoleEnum.safeParse(role);
    return parsed.success && isAdminRole(parsed.data);
  })) {
    return { error: 'Forbidden. Admin access required.', status: 403 };
  }

  return { user, adminSupabase };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: requestId } = await params;
  const auth = await verifyAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { adminSupabase, user: adminUser } = auth;

  const { status, response, internal_notes, type } = await req.json() as ReviewRequestPayload;

  let updateResult: Record<string, unknown> | null = null;

  if (type === 'risk_score') {
    const { data: request, error: updateError } = await adminSupabase
      .from('risk_review_requests')
      .update({
        status,
        internal_notes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUser.id
      })
      .eq('id', requestId)
      .select('*, employer_onboarding(user_id)')
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    updateResult = request;

    if (request.employer_onboarding?.user_id) {
        await pusherServer.trigger(
            `user-${request.employer_onboarding.user_id}`,
            'risk-review-update',
            { id: requestId, status, message: response }
        );
    }

  } else if (type === 'kyc_review') {
    const { data: document, error: updateError } = await adminSupabase
      .from('employee_kyc_documents')
      .update({
        status,
        reviewer_notes: response || internal_notes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUser.id
      })
      .eq('id', requestId)
      .select('*')
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    updateResult = document;

    await pusherServer.trigger(
        `user-${document.user_id}`,
        'kyc-update',
        { id: requestId, status, message: response }
    );

  } else if (type === 'bank_change') {
    const { data: bRequest, error: fetchError } = await adminSupabase
      .from('bank_change_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !bRequest) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    if (status === 'approved') {
      const updateData = {
        bank_name: bRequest.new_bank_name,
        bank_account_number: bRequest.new_account_number,
        updated_at: new Date().toISOString()
      };

      await adminSupabase
        .from('employer_onboarding')
        .update(updateData)
        .eq('id', bRequest.employer_id);

      await adminSupabase
        .from('employers')
        .update(updateData)
        .eq('id', bRequest.employer_id);
    }

    const { data: updatedRequest, error: updateError } = await adminSupabase
      .from('bank_change_requests')
      .update({
        status,
        internal_notes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUser.id
      })
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    updateResult = updatedRequest;

    if (bRequest.user_id) {
      const { data: notif } = await adminSupabase
        .from('notifications')
        .insert({
          user_id: bRequest.user_id,
          type: 'system',
          title: `Bank Details Change ${status === 'approved' ? 'Approved' : 'Rejected'}`,
          message: status === 'approved' 
            ? 'Your request to change bank details has been approved and updated.'
            : `Your bank details change request was rejected. ${response ? `Reason: ${response}` : ''}`,
          read: false
        })
        .select()
        .single();

      if (notif) {
        await pusherServer.trigger(`employer-${bRequest.user_id}`, 'new-notification', notif);
      }
    }
  }

  if (updateResult) {
    await pusherServer.trigger('admin-reviews', 'request-updated', { 
      id: requestId, 
      status, 
      type,
      updated_at: new Date().toISOString()
    });
    
    return NextResponse.json({ message: 'Request updated successfully', data: updateResult });
  }

  return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
}
