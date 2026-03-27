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
import pusherServer from '@/lib/pusher-server';

export const runtime = 'nodejs';

const BUCKET = 'employee-kyc-documents';

function createAdminClient() {
  const env = getEnv();
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

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

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');

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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    const form = await req.formData();
    const file = form.get('file') as File | null;
    const rawDocType = form.get('document_type') as string | null;
    const documentNumber = (form.get('document_number') as string | null)?.trim() || null;

    if (!file) {
      return NextResponse.json(
        { 
          error: 'No file provided', 
          code: 'FILE_REQUIRED',
          keys: Array.from(form.keys()) 
        }, 
        { status: 400 }
      );
    }

    const parsedDocType = DocumentTypeEnum.safeParse(rawDocType);
    if (!parsedDocType.success) {
      return NextResponse.json(
        {
          error: `Invalid document_type: "${rawDocType}". Allowed: ${DocumentTypeEnum.options.join(', ')}`,
          code: 'INVALID_DOC_TYPE',
          details: parsedDocType.error.format()
        },
        { status: 400 }
      );
    }
    const documentType = parsedDocType.data;

    if (!ALLOWED_MIME_TYPES.some((allowed) => allowed === file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WEBP, PDF, CSV, XLSX', code: 'INVALID_FILE_TYPE' },
        { status: 422 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size must be under 5 MB.', code: 'FILE_TOO_LARGE' }, { status: 422 });
    }

    const ext = file.name.split('.').pop() ?? 'bin';
    const timestamp = Date.now();
    const storagePath = `${user.id}/${documentType}/${timestamp}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await adminSupabase.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error('[KYC Upload] Storage error:', uploadError);
      return NextResponse.json({ error: 'Upload failed', code: 'UPLOAD_ERROR' }, { status: 500 });
    }

    const { data: signedData } = await adminSupabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    if (!signedData) {
      return NextResponse.json({ error: 'Could not generate URL', code: 'SIGNED_URL_ERROR' }, { status: 500 });
    }

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
        },
        { onConflict: 'user_id,document_type' }
      )
      .select()
      .single();

    if (saveError) {
      console.error('[KYC Upload] DB error:', saveError);
      return NextResponse.json({ error: 'Failed to save document metadata', code: 'SAVE_ERROR', details: saveError }, { status: 500 });
    }

    const parsedResult = KYCDocumentSchema.safeParse(savedDoc);
    if (!parsedResult.success) {
        console.error('[KYC Upload] Schema validation failed:', parsedResult.error.format());
        return NextResponse.json({ 
            ...savedDoc, 
            warning: 'Schema validation mismatch',
            errors: parsedResult.error.format() 
        }, { status: 201 });
    }

    const validatedDoc = parsedResult.data;

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
        .catch((error: Error) => {
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

    try {
      const { data: empOnboarding } = await adminSupabase
        .from('employee_onboarding')
        .select('employer_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (empOnboarding?.employer_id) {
        const { data: employer } = await adminSupabase
          .from('employer_onboarding')
          .select('user_id, company_name')
          .eq('id', empOnboarding.employer_id)
          .maybeSingle();

        if (employer?.user_id) {
          const { data: empNotif, error: empNotifError } = await adminSupabase
            .from('notifications')
            .insert({
              user_id: employer.user_id,
              type: 'employee',
              title: 'KYC Document Uploaded',
              message: `${profile?.full_name || 'An employee'} has uploaded a new ${documentType}.`,
              read: false,
            })
            .select()
            .single();

          if (!empNotifError && empNotif) {
            await pusherServer.trigger(`employer-${employer.user_id}`, 'new-notification', empNotif);
          }

          const { data: adminNotif, error: adminNotifError } = await adminSupabase
            .from('admin_notifications')
            .insert({
              type: 'review_request',
              title: 'New KYC Document',
              message: `${profile?.full_name || 'An employee'} from ${employer.company_name} uploaded a ${documentType}.`,
              read: false,
              metadata: {
                user_id: user.id,
                employer_id: empOnboarding.employer_id,
                document_type: documentType,
              },
            })
            .select()
            .single();

          if (!adminNotifError && adminNotif) {
            await pusherServer.trigger('admin-notifications', 'new-notification', adminNotif);
          }
        }
      }
    } catch (notifErr) {
      console.error('[POST /kyc/documents] Notification error:', notifErr);
    }

    return NextResponse.json(validatedDoc, { status: 201 });
  } catch (err: unknown) {
    console.error('[KYC POST] Full error object:', JSON.stringify(err, null, 2));
    const errMessage = err instanceof Error ? err.message : 'Internal server error';
    const errStack = err instanceof Error ? err.stack : undefined;
    console.error('[KYC POST] Error message:', errMessage);
    console.error('[KYC POST] Error stack:', errStack);
    
    return NextResponse.json({ 
        error: errMessage, 
        code: 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? err : undefined
    }, { status: 500 });
  }
}
