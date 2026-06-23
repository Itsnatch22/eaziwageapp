import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function PATCH(
  _request: NextRequest,
  context: IdRouteContext
) {
  const { id } = await context.params;
  try {
    const rateLimitResponse = await checkAdminRateLimit(_request);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;

    const { data: tx, error: txError } = await adminSupabase
      .from('wallet_transactions')
      .select('id, wallet_id, amount, type, status, reference, description, metadata')
      .eq('id', id)
      .maybeSingle();

    if (txError) throw txError;
    if (!tx) return NextResponse.json({ error: 'Top-up request not found' }, { status: 404 });

    if (tx.type !== 'deposit' || tx.status !== 'pending') {
      return NextResponse.json({ error: 'Transaction is not a pending deposit request' }, { status: 422 });
    }

    let employerId: string | undefined = undefined;
    if (tx.metadata && typeof tx.metadata === 'object' && 'employer_id' in tx.metadata) {
      const rawEmployerId = (tx.metadata as Record<string, unknown>).employer_id;
      if (typeof rawEmployerId === 'string') employerId = rawEmployerId;
    }

    if (!employerId) {
      const { data: walletRow, error: walletErr } = await adminSupabase
        .from('employer_wallets')
        .select('employer_id')
        .eq('id', tx.wallet_id)
        .maybeSingle();
      if (walletErr) throw walletErr;
      employerId = walletRow?.employer_id as string | undefined;
    }

    if (!employerId) return NextResponse.json({ error: 'Unable to resolve employer for this top-up request' }, { status: 500 });

    const { data: adminWallet, error: adminWalletErr } = await adminSupabase
      .from('admin_wallets')
      .select('id, balance')
      .eq('name', 'Main Stanbic Source')
      .maybeSingle();
    if (adminWalletErr || !adminWallet) throw adminWalletErr || new Error('Admin wallet not found');

     const { error: rpcError } = await adminSupabase.rpc('fund_employer_from_admin', {
      p_employer_id: employerId,
      p_admin_wallet_id: adminWallet.id,
      p_amount: tx.amount,
      p_description: tx.description || `Top-up approved ${tx.reference ?? ''}`,
      p_admin_id: user.id,
    });

    if (rpcError) {
      console.error('[TopUp Approve] RPC error:', rpcError);
      return NextResponse.json({ error: `Funding failed: ${rpcError.message}` }, { status: 500 });
    }

    const updatedMetadata = Object.assign({}, tx.metadata ?? {}, { approved_by: user.id, approved_at: new Date().toISOString() });
    const { error: updateError } = await adminSupabase
      .from('wallet_transactions')
      .update({ status: 'completed', metadata: updatedMetadata })
      .eq('id', id);

    if (updateError) {
      console.error('[TopUp Approve] Failed to update request row:', updateError);
      return NextResponse.json({ error: 'Funding succeeded but failed to update request record' }, { status: 500 });
    }

    try {
      const { notifyEmployer } = await import('@/lib/notifications');
      await notifyEmployer({
        userId: employerId,
        type: 'system',
        title: 'Top-up Approved',
        message: `Your top-up request of ${tx.amount} has been approved and applied to your wallet.`,
        metadata: { wallet_transaction_id: id, amount: tx.amount }
      });
    } catch (notifyErr) {
      console.error('[TopUp Approve] notifyEmployer failed:', notifyErr);
    }

    return NextResponse.json({ success: true, funded: true, request_id: id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Admin TopUp Approve] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
