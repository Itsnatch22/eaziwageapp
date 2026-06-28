import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing log id' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('error_logs')
    .update({ resolved: true })
    .eq('id', id);

  if (error) {
    console.error('[Admin Logs Resolve]', error);
    return NextResponse.json({ error: 'Failed to resolve log' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
