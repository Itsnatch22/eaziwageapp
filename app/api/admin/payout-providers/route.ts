import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { z } from 'zod';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { checkAdminAccess } from '@/lib/server/admin-auth';

function createAdminClient() {
  const env = getEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

const ProviderSchema = z.object({
  country_code: z.string().min(2).max(2),
  provider_key: z.string().min(1),
  provider_name: z.string().min(1),
  method_type: z.enum(['mobile_money','bank_account']),
  config: z.any().optional(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  const supabase = await createRouteHandlerClient();
  const adminSupabase = createAdminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await checkAdminAccess({ user, adminSupabase });
  if (!access.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await adminSupabase.from('payout_providers').select('*').order('country_code');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ providers: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const adminSupabase = createAdminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await checkAdminAccess({ user, adminSupabase });
  if (!access.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = ProviderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });

  const payload = { ...parsed.data, enabled: parsed.data.enabled ?? true };
  const { data, error } = await adminSupabase.from('payout_providers').insert(payload).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ provider: data });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const adminSupabase = createAdminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await checkAdminAccess({ user, adminSupabase });
  if (!access.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = body.id;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { data, error } = await adminSupabase.from('payout_providers').update(body).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ provider: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const adminSupabase = createAdminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await checkAdminAccess({ user, adminSupabase });
  if (!access.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await adminSupabase.from('payout_providers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
