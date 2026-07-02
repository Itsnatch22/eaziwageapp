import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { dbErrorResponse } from '@/lib/api-errors';

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
      .select('id, wallet_id, amount, type, status, reference, description, metadata, local_currency, usd_amount, rate_snapshot')
      .eq('id', id)
      .maybeSingle() as { data: {
        id: string; wallet_id: string; amount: number; type: string; status: string;
        reference: string | null; description: string | null; metadata: Record<string, unknown> | null;
        local_currency: string | null; usd_amount: number | null; rate_snapshot: number | null;
      } | null; error: unknown };

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

    // Admin wallet is USD-denominated. Deduct the USD equivalent, not the local amount.
    const amountToDeductUSD = tx.usd_amount ?? tx.amount;

    const { error: rpcError } = await adminSupabase.rpc('fund_employer_from_admin', {
      p_employer_id: employerId,
      p_admin_wallet_id: adminWallet.id,
      p_amount: amountToDeductUSD,
      p_description: tx.description || `Top-up approved ${tx.reference ?? ''}`,
      p_admin_id: user.id,
    });

    if (rpcError) {
      return dbErrorResponse('admin/wallet/topup-requests/approve', rpcError, 'Funding failed. Please try again.');
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

      const { data: employer } = await adminSupabase
        .from('employers')
        .select('user_id, company_name, contact_person, currency')
        .eq('id', employerId)
        .maybeSingle();

      if (employer?.user_id) {
        const currency = employer.currency ?? 'KES';
        await notifyEmployer({
          userId: employer.user_id,
          type: 'wallet_topup_approved',
          title: 'Wallet Top-Up Approved',
          message: `Your wallet top-up of ${currency} ${Number(tx.amount).toLocaleString()} has been approved and credited to your account.`,
          metadata: {
            wallet_transaction_id: id,
            approvedAmount: tx.amount,
            currency,
            companyName: employer.company_name,
            contactPerson: employer.contact_person ?? undefined,
            reference: tx.reference ?? undefined,
            approvedAt: new Date().toLocaleString(),
          },
        });
      }
    } catch (notifyErr) {
      console.error('[TopUp Approve] notifyEmployer failed:', notifyErr);
    }

    void adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id,
      admin_name: user.email,
      target_id: id,
      target_type: 'wallet_transaction',
      action: 'wallet_topup_approved',
      old_value: { status: 'pending' },
      new_value: { status: 'completed', local_amount: tx.amount, local_currency: tx.local_currency, usd_amount: amountToDeductUSD },
      metadata: { employer_id: employerId, reference: tx.reference },
    }).then(({ error }) => { if (error) console.error('[audit] wallet_topup_approved:', error); });

    return NextResponse.json({ success: true, funded: true, request_id: id });
  } catch (err: unknown) {
    return dbErrorResponse('admin/wallet/topup-requests/approve', err);
  }
}
