import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';

const ProviderSchema = z.object({
  country_code: z.string().min(2).max(2),
  provider_key: z.string().min(1),
  provider_name: z.string().min(1),
  method_type: z.enum(['mobile_money','bank_account']),
  config: z.any().optional(),
  enabled: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const rateLimitResponse = await checkAdminRateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { adminSupabase } = auth;

  const { data, error } = await adminSupabase.from('payout_providers').select('id, country_code, provider_key, provider_name, method_type, config, enabled, created_at, updated_at').order('country_code');
  if (error) {
    console.error('[admin-payout-providers] DB error:', error);
    return NextResponse.json({ error: 'Failed to fetch payout providers' }, { status: 500 });
  }
  return NextResponse.json({ providers: data });
}

export async function POST(req: NextRequest) {
  const rateLimitResponse = await checkAdminRateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { adminSupabase, user } = auth;

  const body = await req.json().catch(() => ({}));
  const parsed = ProviderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });

  const payload = { ...parsed.data, enabled: parsed.data.enabled ?? true };
  const { data, error } = await adminSupabase.from('payout_providers').insert(payload).select('id, country_code, provider_key, provider_name, method_type, config, enabled, created_at, updated_at').single();
  if (error) {
    console.error('[admin-payout-providers] Insert error:', error);
    return NextResponse.json({ error: 'Failed to create payout provider' }, { status: 500 });
  }

  void adminSupabase.from('system_audit_logs').insert({
    admin_id: user.id,
    admin_name: user.email,
    target_id: data.id,
    target_type: 'payout_provider',
    action: 'payout_provider_created',
    old_value: null,
    new_value: payload,
    metadata: {},
  }).then(({ error: auditErr }) => { if (auditErr) console.error('[audit] payout_provider_created:', auditErr); });

  return NextResponse.json({ provider: data });
}

export async function PATCH(req: NextRequest) {
  const rateLimitResponse = await checkAdminRateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { adminSupabase, user } = auth;

  const body = await req.json().catch(() => ({}));
  const id = body.id;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { data, error } = await adminSupabase.from('payout_providers').update(body).eq('id', id).select('id, country_code, provider_key, provider_name, method_type, config, enabled, created_at, updated_at').single();
  if (error) {
    console.error('[admin-payout-providers] Update error:', error);
    return NextResponse.json({ error: 'Failed to update payout provider' }, { status: 500 });
  }

  void adminSupabase.from('system_audit_logs').insert({
    admin_id: user.id,
    admin_name: user.email,
    target_id: id,
    target_type: 'payout_provider',
    action: 'payout_provider_updated',
    old_value: null,
    new_value: data,
    metadata: {},
  }).then(({ error: auditErr }) => { if (auditErr) console.error('[audit] payout_provider_updated:', auditErr); });

  return NextResponse.json({ provider: data });
}

export async function DELETE(req: NextRequest) {
  const rateLimitResponse = await checkAdminRateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { adminSupabase, user } = auth;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await adminSupabase.from('payout_providers').delete().eq('id', id);
  if (error) {
    console.error('[admin-payout-providers] Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete payout provider' }, { status: 500 });
  }

  void adminSupabase.from('system_audit_logs').insert({
    admin_id: user.id,
    admin_name: user.email,
    target_id: id,
    target_type: 'payout_provider',
    action: 'payout_provider_deleted',
    old_value: { id },
    new_value: null,
    metadata: {},
  }).then(({ error: auditErr }) => { if (auditErr) console.error('[audit] payout_provider_deleted:', auditErr); });

  return NextResponse.json({ success: true });
}
