import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import { processApprovedAdvances } from '@/lib/advanceProcessor';

function createAdminClient() {
  const env = getEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const adminSupabase = createAdminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await checkAdminAccess({ user, adminSupabase });
  if (!access.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { processed } = await processApprovedAdvances(adminSupabase, 50);
    return NextResponse.json({ success: true, processed });
  } catch (err: any) {
    console.error('process-advances failed', err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
