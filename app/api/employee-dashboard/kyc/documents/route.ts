import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { employeeDocumentTypeSchema } from '@/lib/validations/employee-validation';

export const runtime = 'nodejs';

const BUCKET = 'KYC';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

type DocumentStatus = 'pending' | 'approved' | 'rejected';

function createAdminClient() {
  const env = getEnv();
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as DocumentStatus | null;

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string | null }>();

  const isAdmin = ['admin', 'super_admin', 'compliance'].includes(profile?.role ?? '');

  let query = adminSupabase
    .from('employee_kyc_documents')
    .select('id, user_id, document_type, document_url, document_number, status, reviewer_notes, reviewed_at, reviewed_by, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (!isAdmin) {
    query = query.eq('user_id', user.id);
  }

  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[kyc/documents/list]', error);
    return NextResponse.json({ error: 'Failed to load KYC documents.' }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const adminSupabase = createAdminClient();

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
  const documentNumber = (form.get('document_number') as string | null)?.trim() || null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const parsed = employeeDocumentTypeSchema.safeParse(rawDocType);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Invalid document_type. Allowed: ${employeeDocumentTypeSchema.options.join(', ')}` },
      { status: 400 },
    );
  }
  const documentType = parsed.data;

  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Upload JPEG, PNG, WEBP or PDF.' }, { status: 422 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File size must be under 5 MB.' }, { status: 422 });
  }

  const ext = file.name.split('.').pop() ?? 'bin';
  const storagePath = `${user.id}/${documentType}/${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await adminSupabase.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('[kyc/documents/upload]', uploadError);
    return NextResponse.json({ error: 'Failed to upload file. Please try again.' }, { status: 500 });
  }

  const { data: signedData, error: signedError } = await adminSupabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  if (signedError || !signedData) {
    return NextResponse.json({ error: 'Uploaded but could not generate URL.' }, { status: 500 });
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
        reviewer_notes: null,
        reviewed_at: null,
        reviewed_by: null,
      },
      { onConflict: 'user_id,document_type' },
    )
    .select('id, user_id, document_type, document_url, document_number, status, reviewer_notes, reviewed_at, reviewed_by, created_at, updated_at')
    .single();

  if (saveError) {
    console.error('[kyc/documents/save]', saveError);
    return NextResponse.json({ error: 'Failed to save KYC document metadata.' }, { status: 500 });
  }

  return NextResponse.json(savedDoc, { status: 201 });
}
