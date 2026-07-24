import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getSafeFileExtension, isDocumentFile } from '@/lib/upload-file-types';
import { MAX_FILE_SIZE } from '@/lib/validations/kyc-validation';
import { notifyAdmin } from '@/lib/notifications';
import { dbErrorResponse } from '@/lib/api-errors';

export const runtime = 'nodejs';

const BUCKET = 'employee-kyc-documents';

// Bank-account verification is isolated from the employee_kyc_documents /
// onboarding-KYC system on purpose — see app/api/admin/kyc/documents/[id]/review/route.ts,
// which recomputes the employee's overall onboarding status from every KYC doc they
// have. Folding a payment-method proof into that would risk flipping an already-active
// employee's onboarding status back to 'pending' just for adding a bank account.
// This route only ever touches this one payment_methods row.
export async function POST(
  req: NextRequest,
  { params }: IdRouteContext,
) {
  try {
    const { id: paymentMethodId } = await params;

    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: employee } = await adminSupabase
      .from('employees')
      .select('id, full_name, employer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!employee) return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });

    const { data: pm, error: pmError } = await adminSupabase
      .from('payment_methods')
      .select('id, employee_id, method_type, is_verified')
      .eq('id', paymentMethodId)
      .maybeSingle();

    if (pmError) return dbErrorResponse('payment-methods/document', pmError);
    if (!pm) return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
    if (pm.employee_id !== employee.id) {
      return NextResponse.json({ error: 'Payment method does not belong to you' }, { status: 403 });
    }
    if (pm.method_type !== 'bank_account') {
      return NextResponse.json({ error: 'Document verification only applies to bank accounts' }, { status: 400 });
    }
    if (pm.is_verified) {
      return NextResponse.json({ success: true, message: 'Already verified' });
    }

    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });

    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    if (!isDocumentFile(file)) {
      return NextResponse.json({ error: 'Invalid file type. Upload an image or document file.' }, { status: 422 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size must be under 5 MB.' }, { status: 422 });
    }

    const ext = getSafeFileExtension(file);
    const storagePath = `${employee.id}/bank-verification/${paymentMethodId}/${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();

    // Compute a checksum for tamper detection/auditability before upload
    const buffer = Buffer.from(arrayBuffer);
    const checksum = (await import('@/lib/fileUtils')).computeChecksum(buffer);

    const { error: uploadError } = await adminSupabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error('[payment-methods/document] Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file. Please try again.' }, { status: 500 });
    }

    const verificationMetadata = {
      filename: (file as File & { name?: string })?.name ?? null,
      content_type: file.type ?? null,
      checksum,
      scan_status: 'queued', // placeholder for async virus/scan pipeline
    };

    const { data: updated, error: updateError } = await adminSupabase
      .from('payment_methods')
      .update({
        verification_document_path: storagePath,
        verification_status: 'pending_review',
        verification_notes: null,
        verification_metadata: verificationMetadata,
        verification_document_hash: checksum,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentMethodId)
      .select('id, verification_status, verification_metadata, verification_document_hash')
      .single();

    if (updateError) {
      console.error('[payment-methods/document] DB update error:', updateError);
      return NextResponse.json({ error: 'File uploaded but failed to save record. Contact support.' }, { status: 500 });
    }

    await notifyAdmin({
      type: 'review_request',
      title: 'Bank Account Verification Requested',
      message: `${employee.full_name || 'An employee'} uploaded proof of ownership for a bank account and is awaiting review.`,
      metadata: {
        employee_id: employee.id,
        employer_id: employee.employer_id,
        payment_method_id: paymentMethodId,
      },
    });

    return NextResponse.json({ success: true, payment_method: updated });
  } catch (err) {
    console.error('[payment-methods/document] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
