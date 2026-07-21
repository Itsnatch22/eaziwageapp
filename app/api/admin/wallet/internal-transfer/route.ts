import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { dbErrorResponse } from '@/lib/api-errors';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;

    const body = await req.json().catch(() => null) as {
      country_code?: string;
      from_currency?: string;
      to_currency?: string;
      from_amount?: number;
      to_amount?: number;
      rate_snapshot?: number;
      reference?: string;
      description?: string;
    } | null;

    if (!body?.from_currency || !body?.to_currency || !body.from_amount || !body.to_amount) {
      return NextResponse.json({ error: 'from_currency, to_currency, from_amount, and to_amount are required' }, { status: 422 });
    }

    const reference = body.reference || `TREASURY-${Date.now()}`;

    const { error } = await adminSupabase.rpc('transfer_admin_treasury_funds', {
      p_country_code: body.country_code || 'KE',
      p_from_currency: body.from_currency,
      p_to_currency: body.to_currency,
      p_from_amount: Number(body.from_amount),
      p_to_amount: Number(body.to_amount),
      p_rate_snapshot: Number(body.rate_snapshot ?? 1),
      p_reference: reference,
      p_admin_id: user.id,
      p_description: body.description || 'Internal treasury transfer',
    });

    if (error) throw error;

    void adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id,
      admin_name: user.email,
      target_type: 'admin_wallet',
      action: 'internal_treasury_transfer',
      new_value: {
        country_code: body.country_code || 'KE',
        from_currency: body.from_currency,
        to_currency: body.to_currency,
        from_amount: body.from_amount,
        to_amount: body.to_amount,
        reference,
      },
    }).then(({ error: auditError }) => {
      if (auditError) console.error('[audit] internal_treasury_transfer:', auditError);
    });

    return NextResponse.json({ success: true, reference });
  } catch (err: unknown) {
    return dbErrorResponse('admin/wallet/internal-transfer', err);
  }
}
