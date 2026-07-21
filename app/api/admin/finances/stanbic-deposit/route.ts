import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { StanbicDepositSchema } from '@/lib/validations/route-schemas';
import { dbErrorResponse } from '@/lib/api-errors';

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase, user } = auth;

    const raw = await req.json().catch(() => null);
    const parsed = StanbicDepositSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 422 },
      );
    }
    const { wallet_id, amount, reference, description } = parsed.data;

    let walletQuery = adminSupabase
      .from('admin_wallets')
      .select('id, name, currency');

    if (wallet_id) {
      walletQuery = walletQuery.eq('id', wallet_id);
    } else {
      walletQuery = walletQuery.eq('name', 'Main Stanbic Source');
    }

    const { data: wallet, error: walletError } = await walletQuery.maybeSingle();

    if (walletError || !wallet) {
      throw new Error('Target admin wallet not found');
    }

    const { error: txError } = await adminSupabase.rpc('admin_deposit', {
      p_wallet_id: wallet.id,
      p_amount: amount,
      p_reference: reference || `STANBIC-${Date.now()}`,
      p_description: description || 'Direct deposit from Stanbic Bank'
    });

    if (txError) throw txError;

    void adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id,
      admin_name: user.email,
      target_id: wallet.id,
      target_type: 'admin_wallet',
      action: 'stanbic_deposit_recorded',
      old_value: null,
      new_value: { amount, reference: reference || `STANBIC-${Date.now()}` },
      metadata: { description },
    }).then(({ error }) => { if (error) console.error('[audit] stanbic_deposit_recorded:', error); });

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    return dbErrorResponse('admin/finances/stanbic-deposit', err);
  }
}
