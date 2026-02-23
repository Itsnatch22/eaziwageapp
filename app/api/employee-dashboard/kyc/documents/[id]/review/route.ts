import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';

const reviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  notes: z.string().max(1000).optional().default(''),
});

function createAdminClient() {
  const env = getEnv();
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createRouteHandlerClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string | null }>();

  const isAdmin = ['admin', 'super_admin', 'compliance'].includes(profile?.role ?? '');
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Document id is required' }, { status: 400 });
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
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
  }

  const parsed = reviewSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 422 });
  }

  const { data, error } = await adminSupabase
    .from('employee_kyc_documents')
    .update({
      status: parsed.data.status,
      reviewer_notes: parsed.data.notes || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', id)
    .select('id, user_id, document_type, document_url, document_number, status, reviewer_notes, reviewed_at, reviewed_by, created_at, updated_at')
    .single();

  if (error || !data) {
    console.error('[kyc/documents/review]', error);
    return NextResponse.json({ error: 'Failed to update document review status.' }, { status: 500 });
  }

  return NextResponse.json(data);
}
