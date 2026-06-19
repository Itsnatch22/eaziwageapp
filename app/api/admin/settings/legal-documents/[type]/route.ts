import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { LegalDocumentSchema } from '@/lib/validations/admin-settings';
import { checkAdminAccess } from '@/lib/server/admin-auth';

function createAdminClient() {
  const env = getEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function verifyAdmin(supabase: SupabaseClient, adminSupabase: SupabaseClient) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const access = await checkAdminAccess({ user, adminSupabase });
  if (!access.isAdmin) return null;

  return user;
}

export async function GET(req: NextRequest, { params }: AppRouteContext<{ type: string }>) {
  try {
    const { type } = await params;
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();
    const user = await verifyAdmin(supabase, adminSupabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await adminSupabase.from('legal_documents').select('*').eq('document_type', type).eq('is_active', true).maybeSingle();
    if (error) throw error;
    return NextResponse.json(data || { document_type: type, content: '', title: '', version: '1.0' });
  } catch (error) {
    console.error('[GET /api/admin/settings/legal-documents/[type]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: AppRouteContext<{ type: string }>) {
  try {
    const { type } = await params;
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();
    const user = await verifyAdmin(supabase, adminSupabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const validated = LegalDocumentSchema.parse({ ...body, document_type: type });

    await adminSupabase.from('legal_documents').update({ is_active: false }).eq('document_type', type);

    const { data, error } = await adminSupabase.from('legal_documents').insert([{ ...validated, is_active: true }]).select().single();
    if (error) throw error;

    await adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id, admin_name: user.email, target_id: type, target_type: 'legal_document', action: 'update_legal_document',
      new_value: data, created_at: new Date().toISOString()
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[PUT /api/admin/settings/legal-documents/[type]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
