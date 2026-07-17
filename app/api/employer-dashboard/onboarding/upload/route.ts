import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { documentTypeSchema } from '@/lib/validations/employer-onboarding';
import { isDocumentFile } from '@/lib/upload-file-types';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const BUCKET = 'employer-documents';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = form.get('file') as File | null;
  const rawDocType = form.get('document_type') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const parsed = documentTypeSchema.safeParse(rawDocType);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Invalid document_type. Allowed: ${documentTypeSchema.options.join(', ')}` },
      { status: 400 },
    );
  }
  const documentType = parsed.data;

  if (!isDocumentFile(file)) {
    return NextResponse.json(
      { error: 'Invalid file type. Upload an image or document file.' },
      { status: 422 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File size must be under 10 MB.' }, { status: 422 });
  }

  const { data: onboarding, error: onboardingError } = await supabase
    .from('employer_onboarding')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (onboardingError || !onboarding) {
    return NextResponse.json(
      { error: 'No onboarding record found. Complete company details first.' },
      { status: 404 },
    );
  }

  // The employer_docs_upload/read/delete RLS policies on storage.objects all
  // check (storage.foldername(name))[1] = auth.uid()::text — the first path
  // segment must be the authenticated user's own ID. This previously used
  // onboarding.id (employer_onboarding's own primary key, a different UUID
  // from the user's auth ID), which can never satisfy that check — every
  // upload failed RLS with "new row violates row-level security policy".
  // app/api/employer-dashboard/settings/documents/route.ts already uses the
  // correct `${user.id}/...` pattern for the same bucket; mirrored here.
  const ext = file.name.split('.').pop() ?? 'bin';
  const storagePath = `${user.id}/${documentType}/${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('[upload]', uploadError);
    return NextResponse.json({ error: 'Failed to upload file. Please try again.' }, { status: 500 });
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  if (signedError || !signedData) {
    return NextResponse.json({ error: 'Uploaded but could not create URL.' }, { status: 500 });
  }

  // employer_kyc_documents has no INSERT/UPDATE RLS policy for regular users
  // (only a read-your-own-rows SELECT policy) — writes must go through the
  // service-role client.
  const adminSupabase = createAdminClient();
  const { error: docError } = await adminSupabase
    .from('employer_kyc_documents')
    .upsert(
      {
        user_id: user.id,
        document_type: documentType,
        document_url: signedData.signedUrl,
        storage_path: storagePath,
        status: 'pending',
      },
      { onConflict: 'user_id,document_type' },
    );

  if (docError) {
    console.error('[upload] DB write-back failed:', docError);
    return NextResponse.json(
      { error: 'File uploaded but failed to save record. Contact support.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    document_type: documentType,
    document_url: signedData.signedUrl,
    storage_path: storagePath,
  });
}