import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import {
  DocumentReviewSchema,
  KYCDocumentSchema,
  isAdminRole,
} from '@/lib/validations/kyc-validation';
import { sendKYCNotification, logEmail } from '@/lib/email-service';

/**
 * Create admin Supabase client with service role
 */
function createAdminClient() {
  const env = getEnv();
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}

/**
 * PATCH /api/employee-dashboard/kyc/documents/[id]/review
 * Review and update document status (admin only)
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', user.id)
      .maybeSingle<{ role: string | null; full_name: string | null; email: string | null }>();

    const isAdmin = isAdminRole(profile?.role as any);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Get document ID from params
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required', code: 'ID_REQUIRED' },
        { status: 400 }
      );
    }

    // Parse request payload
    let payload: unknown;
    const statusFromQuery = req.nextUrl.searchParams.get('status');
    const notesFromQuery = req.nextUrl.searchParams.get('notes');

    if (statusFromQuery) {
      // Support query params for simpler API calls
      payload = {
        status: statusFromQuery,
        notes: notesFromQuery ?? '',
      };
    } else {
      // Parse JSON body
      try {
        payload = await req.json();
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON body', code: 'INVALID_JSON' },
          { status: 400 }
        );
      }
    }

    // Validate payload
    const parsed = DocumentReviewSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? 'Invalid payload',
          code: 'VALIDATION_ERROR',
          details: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const { status, notes } = parsed.data;

    // Fetch the document before updating to get user info
    const { data: existingDoc, error: fetchError } = await adminSupabase
      .from('employee_kyc_documents')
      .select(`
        id,
        user_id,
        document_type,
        document_number,
        status
      `)
      .eq('id', id)
      .single();

    if (fetchError || !existingDoc) {
      console.error('[PATCH /kyc/documents/review] Fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Document not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Update document status
    const { data: updatedDoc, error: updateError } = await adminSupabase
      .from('employee_kyc_documents')
      .update({
        status: status,
        reviewer_notes: notes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updatedDoc) {
      console.error('[PATCH /kyc/documents/review] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update document review status.', code: 'UPDATE_ERROR' },
        { status: 500 }
      );
    }

    // Validate updated document
    const validatedDoc = KYCDocumentSchema.parse(updatedDoc);

    // Get employee profile for notification
    const { data: employeeProfile } = await adminSupabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', existingDoc.user_id)
      .single<{ full_name: string | null; email: string | null }>();

    // Send email notification (async, don't block response)
    if (employeeProfile?.email) {
      sendKYCNotification({
        recipientEmail: employeeProfile.email,
        recipientName: employeeProfile.full_name || 'User',
        documentType: existingDoc.document_type,
        documentStatus: status,
        documentNumber: existingDoc.document_number || undefined,
        reviewerNotes: notes || undefined,
      })
        .then(() => {
          logEmail({
            recipientId: existingDoc.user_id,
            recipientEmail: employeeProfile.email!,
            subject: `Document ${status}: ${existingDoc.document_type}`,
            templateName: `document_${status}`,
            status: 'sent',
            metadata: {
              document_id: id,
              reviewer_id: user.id,
              reviewer_name: profile?.full_name,
            },
          });
        })
        .catch((error) => {
          console.error('[PATCH /kyc/documents/review] Email error:', error);
          logEmail({
            recipientId: existingDoc.user_id,
            recipientEmail: employeeProfile.email!,
            subject: `Document ${status}: ${existingDoc.document_type}`,
            templateName: `document_${status}`,
            status: 'failed',
            errorMessage: error.message,
          });
        });
    }

    return NextResponse.json(
      {
        data: validatedDoc,
        message: `Document ${status} successfully`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[PATCH /kyc/documents/review] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}