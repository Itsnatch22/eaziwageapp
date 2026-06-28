import { NextRequest, NextResponse } from 'next/server';
import { LegalDocumentSchema } from '@/lib/validations/admin-settings';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest, { params }: AppRouteContext<{ type: string }>) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { type } = await params;
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;
    const { data, error } = await adminSupabase.from('legal_documents').select('*').eq('document_type', type).eq('is_active', 1).maybeSingle();
    if (error) throw error;
    return NextResponse.json(data || { document_type: type, content: '', title: '', version: '1.0' });
  } catch (error) {
    console.error('[GET /api/admin/settings/legal-documents/[type]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: AppRouteContext<{ type: string }>) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { type } = await params;
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;
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
