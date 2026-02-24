import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import {
  DocumentTypeEnum,
  DocumentStatusEnum,
  KYCDocumentSchema,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from '@/lib/validations/kyc-validation';
import { sendKYCNotification, logEmail } from '@/lib/email-service';

export const runtime = 'nodejs';

const BUCKET = 'KYC';

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
 * GET /api/employee-dashboard/kyc/documents
 * List KYC documents with optional filtering
 */
export async function GET(req: NextRequest) {
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

    // Get user profile to check role
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', user.id)
      .maybeSingle<{ role: string | null; full_name: string | null; email: string | null }>();

    if (profileError) {
      console.error('[GET /kyc/documents] Profile fetch error:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile', code: 'PROFILE_ERROR' },
        { status: 500 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');

    // Validate status if provided
    let status: string | null = null;
    if (statusParam) {
      const parsed = DocumentStatusEnum.safeParse(statusParam);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid status parameter', code: 'INVALID_STATUS' },
          { status: 400 }
        );
      }
      status = parsed.data;
    }

    // Build query
    let query = adminSupabase
      .from('employee_kyc_documents')
      .select(`
        id,
        user_id,
        document_type,
        document_url,
        storage_path,
        document_number,
        status,
        reviewer_notes,
        reviewed_at,
        reviewed_by,
        expiry_date,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false });

    // Employee route should only expose the current user's documents
    query = query.eq('user_id', user.id);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[GET /kyc/documents] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to load KYC documents', code: 'QUERY_ERROR' },
        { status: 500 }
      );
    }

    // Validate response data
    const validatedData = data?.map((doc) => {
      const parsed = KYCDocumentSchema.safeParse(doc);
      return parsed.success ? parsed.data : null;
    }).filter(Boolean) || [];

    return NextResponse.json({ documents: validatedData }, { status: 200 });
  } catch (error) {
    console.error('[GET /kyc/documents] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/employee-dashboard/kyc/documents
 * Upload a new KYC document
 */
export async function POST(req: NextRequest) {
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

    // Get user profile
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single<{ full_name: string | null; email: string | null }>();

    // Parse form data
    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json(
        { error: 'Invalid form data', code: 'INVALID_FORM' },
        { status: 400 }
      );
    }

    const file = form.get('file') as File | null;
    const rawDocType = form.get('document_type') as string | null;
    const documentNumber = (form.get('document_number') as string | null)?.trim() || null;

    // Validate file presence
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided', code: 'FILE_REQUIRED' },
        { status: 400 }
      );
    }

    // Validate document type
    const parsedDocType = DocumentTypeEnum.safeParse(rawDocType);
    if (!parsedDocType.success) {
      return NextResponse.json(
        {
          error: `Invalid document_type. Allowed: ${DocumentTypeEnum.options.join(', ')}`,
          code: 'INVALID_DOC_TYPE',
        },
        { status: 400 }
      );
    }
    const documentType = parsedDocType.data;

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
      return NextResponse.json(
        {
          error: 'Invalid file type. Upload JPEG, PNG, WEBP or PDF.',
          code: 'INVALID_FILE_TYPE',
        },
        { status: 422 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File size must be under 5 MB.',
          code: 'FILE_TOO_LARGE',
        },
        { status: 422 }
      );
    }

    // Generate storage path
    const ext = file.name.split('.').pop() ?? 'bin';
    const timestamp = Date.now();
    const storagePath = `${user.id}/${documentType}/${timestamp}.${ext}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await adminSupabase.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('[POST /kyc/documents] Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file. Please try again.', code: 'UPLOAD_ERROR' },
        { status: 500 }
      );
    }

    // Generate signed URL (valid for 1 year)
    const { data: signedData, error: signedError } = await adminSupabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    if (signedError || !signedData) {
      console.error('[POST /kyc/documents] Signed URL error:', signedError);
      return NextResponse.json(
        { error: 'Uploaded but could not generate URL.', code: 'SIGNED_URL_ERROR' },
        { status: 500 }
      );
    }

    // Save document metadata to database
    const { data: savedDoc, error: saveError } = await adminSupabase
      .from('employee_kyc_documents')
      .upsert(
        {
          user_id: user.id,
          document_type: documentType,
          document_url: signedData.signedUrl,
          storage_path: storagePath,
          document_number: documentNumber,
          status: 'pending',
          reviewer_notes: null,
          reviewed_at: null,
          reviewed_by: null,
        },
        { onConflict: 'user_id,document_type' }
      )
      .select()
      .single();

    if (saveError) {
      console.error('[POST /kyc/documents] Save error:', saveError);
      return NextResponse.json(
        { error: 'Failed to save KYC document metadata.', code: 'SAVE_ERROR' },
        { status: 500 }
      );
    }

    // Validate saved document
    const validatedDoc = KYCDocumentSchema.parse(savedDoc);

    // Send email notification (async, don't block response)
    if (profile?.email) {
      sendKYCNotification({
        recipientEmail: profile.email,
        recipientName: profile.full_name || 'User',
        documentType: documentType,
        documentStatus: 'pending',
        documentNumber: documentNumber || undefined,
      })
        .then(() => {
          logEmail({
            recipientId: user.id,
            recipientEmail: profile.email!,
            subject: `Document Submitted: ${documentType}`,
            templateName: 'document_submitted',
            status: 'sent',
          });
        })
        .catch((error: { message: any; }) => {
          console.error('[POST /kyc/documents] Email error:', error);
          logEmail({
            recipientId: user.id,
            recipientEmail: profile.email!,
            subject: `Document Submitted: ${documentType}`,
            templateName: 'document_submitted',
            status: 'failed',
            errorMessage: error.message,
          });
        });
    }

    return NextResponse.json(validatedDoc, { status: 201 });
  } catch (error) {
    console.error('[POST /kyc/documents] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
