import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAccess } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminAccess = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
    if (adminAccess.error || !adminAccess.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: rows, error } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id, wallet_id, amount, type, status, reference, description, metadata, created_at')
      .eq('type', 'deposit')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ requests: rows ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Admin TopUp Requests GET] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
