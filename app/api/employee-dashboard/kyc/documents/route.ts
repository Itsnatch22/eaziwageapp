// app/api/employee-dashboard/kyc/documents/route.ts
//
// Handles KYC document uploads for employee onboarding.
// Files are stored in the `employee-kyc-documents` Supabase Storage bucket,
// scoped to {userId}/{documentType}/{timestamp}.{ext}
//
import { createClient } from '@/lib/client';
import { NextRequest, NextResponse } from 'next/server';
import { employeeDocumentTypeSchema } from '@/lib/validations/employee-validation';

export const runtime = 'nodejs'; // needs file streaming

const BUCKET = 'employee-kyc-documents';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB (employee docs are smaller)
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // ── Auth guard ────────────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse form data ───────────────────────────────────────────────────────
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = form.get('file') as File | null;
  const rawDocType = form.get('document_type') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // ── Validate document type ────────────────────────────────────────────────
  const parsed = employeeDocumentTypeSchema.safeParse(rawDocType);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: `Invalid document_type. Allowed: ${employeeDocumentTypeSchema.options.join(', ')}`,
      },
      { status: 400 },
    );
  }
  const documentType = parsed.data;

  // ── Validate file ─────────────────────────────────────────────────────────
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Upload JPEG, PNG, WEBP or PDF.' },
      { status: 422 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File size must be under 5 MB.' }, { status: 422 });
  }

  // ── Upload to Supabase Storage ────────────────────────────────────────────
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
    console.error('[kyc/documents/upload]', uploadError);
    return NextResponse.json(
      { error: 'Failed to upload file. Please try again.' },
      { status: 500 },
    );
  }

  // ── Return signed URL (1-year expiry) ─────────────────────────────────────
  const { data: signedData, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  if (signedError || !signedData) {
    return NextResponse.json(
      { error: 'Uploaded but could not generate URL.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    document_type: documentType,
    document_url: signedData.signedUrl,
    storage_path: storagePath,
  });
}