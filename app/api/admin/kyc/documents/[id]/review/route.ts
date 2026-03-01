import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { DocumentReviewSchema, isAdminRole, UserRoleEnum } from '@/lib/validations/kyc-validation';
import { logEmail, sendKYCNotification } from '@/lib/email-service';

function createAdminClient() {
  const env = getEnv();
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .maybeSingle<{ role: string | null; full_name: string | null }>();

    if (profileError) {
      return NextResponse.json({ error: 'Failed to verify role', code: 'ROLE_CHECK_FAILED' }, { status: 500 });
    }

    const roles = [profile?.role, user.app_metadata?.role, user.user_metadata?.role]
      .filter((role): role is string => typeof role === 'string' && role.length > 0)
      .map((role) => role.toLowerCase());

    if (!roles.some((role) => {
      const parsed = UserRoleEnum.safeParse(role);
      return parsed.success && isAdminRole(parsed.data);
    })) {
      return NextResponse.json({ error: 'Forbidden. Admin access required.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Document ID is required', code: 'ID_REQUIRED' }, { status: 400 });
    }

    let payload: unknown;
    const statusFromQuery = req.nextUrl.searchParams.get('status');
    const notesFromQuery = req.nextUrl.searchParams.get('notes');

    if (statusFromQuery) {
      payload = { status: statusFromQuery, notes: notesFromQuery ?? '' };
    } else {
      try {
        payload = await req.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 });
      }
    }

    const parsed = DocumentReviewSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid payload', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    const { status, notes } = parsed.data;

    const { data: existingDoc, error: fetchError } = await adminSupabase
      .from('employee_kyc_documents')
      .select('id,user_id,document_type,document_number')
      .eq('id', id)
      .single();

    if (fetchError || !existingDoc) {
      return NextResponse.json({ error: 'Document not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const { data: updatedDoc, error: updateError } = await adminSupabase
      .from('employee_kyc_documents')
      .update({
        status,
        reviewer_notes: notes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updatedDoc) {
      return NextResponse.json({ error: 'Failed to update review status', code: 'UPDATE_ERROR' }, { status: 500 });
    }

    const { data: employeeProfile } = await adminSupabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', existingDoc.user_id)
      .single<{ full_name: string | null; email: string | null }>();

    if (employeeProfile?.email) {
      sendKYCNotification({
        recipientEmail: employeeProfile.email,
        recipientName: employeeProfile.full_name || 'User',
        documentType: existingDoc.document_type,
        documentStatus: status,
        documentNumber: existingDoc.document_number || undefined,
        reviewerNotes: notes || undefined,
      })
        .then(() =>
          logEmail({
            recipientId: existingDoc.user_id,
            recipientEmail: employeeProfile.email!,
            subject: `Document ${status}: ${existingDoc.document_type}`,
            templateName: `document_${status}`,
            status: 'sent',
            metadata: { document_id: id, reviewer_id: user.id, reviewer_name: profile?.full_name },
          })
        )
        .catch((error) =>
          logEmail({
            recipientId: existingDoc.user_id,
            recipientEmail: employeeProfile.email!,
            subject: `Document ${status}: ${existingDoc.document_type}`,
            templateName: `document_${status}`,
            status: 'failed',
            errorMessage: error.message,
          })
        );
    }

    return NextResponse.json({ data: updatedDoc, message: `Document ${status} successfully` }, { status: 200 });
  } catch (error) {
    console.error('[PATCH /api/admin/kyc/documents/[id]/review] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error', code: 'SERVER_ERROR' }, { status: 500 });
  }
}

