import { NextRequest, NextResponse } from 'next/server';
import { payoutService } from '@/lib/services/payout-service';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';

async function isSystemAdmin(userId: string): Promise<boolean> {
  const env = getEnv();
  const adminSupabase = createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: systemAdmin } = await adminSupabase
    .from('system_admins')
    .select('id, is_admin')
    .eq('id', userId)
    .maybeSingle<{ id: string; is_admin: boolean }>();

  return systemAdmin?.is_admin === true;
}

export async function POST(req: NextRequest) {
  try {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      req.headers.get('Authorization')?.split(' ')[1] || ''
    );
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isSystemAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { employerId, amount, description } = await req.json();

    if (!employerId || !amount) {
      return NextResponse.json({ error: 'Missing employerId or amount' }, { status: 400 });
    }

    const result = await payoutService.fundEmployerWallet(
      employerId,
      amount,
      user.id,
      description
    );

    return NextResponse.json({ success: true, result });

  } catch (err: any) {
    console.error(`[Admin Funding] Error: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
