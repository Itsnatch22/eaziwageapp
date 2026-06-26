import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { notifyEmployer } from '@/lib/notifications';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  context: IdRouteContext
) {
  const { id } = await context.params;
  try {
    const rateLimitResponse = await checkAdminRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;

    const body = await request.json().catch(() => ({})) as { reason?: string };
    const reason: string = body.reason ?? '';

    const { data: tx, error: txError } = await adminSupabase
      .from('wallet_transactions')
      .select('id, wallet_id, amount, type, status, metadata')
      .eq('id', id)
      .maybeSingle();

    if (txError) throw txError;
    if (!tx) return NextResponse.json({ error: 'Top-up request not found' }, { status: 404 });

    if (tx.type !== 'deposit' || tx.status !== 'pending') {
      return NextResponse.json({ error: 'Transaction is not a pending deposit request' }, { status: 422 });
    }

    // Resolve employer id from metadata first, fall back to wallet join
    let employerId: string | undefined;
    const meta = tx.metadata as Record<string, unknown> | null;
    if (typeof meta?.employer_id === 'string') {
      employerId = meta.employer_id;
    } else {
      const { data: walletRow } = await adminSupabase
        .from('employer_wallets')
        .select('employer_id')
        .eq('id', tx.wallet_id)
        .maybeSingle();
      employerId = walletRow?.employer_id as string | undefined;
    }

    if (!employerId) {
      return NextResponse.json({ error: 'Unable to resolve employer for this top-up request' }, { status: 500 });
    }

    const updatedMeta = Object.assign({}, meta ?? {}, {
      rejected_by: user.id,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason || null,
    });

    const { error: updateError } = await adminSupabase
      .from('wallet_transactions')
      .update({ status: 'rejected', metadata: updatedMeta })
      .eq('id', id);

    if (updateError) throw updateError;

    // Audit trail
    void adminSupabase.from('system_audit_logs').insert({
      admin_id:    user.id,
      admin_name:  user.email,
      target_id:   id,
      target_type: 'wallet_transaction',
      action:      'topup_rejected',
      new_value:   { status: 'rejected', reason: reason || null },
      created_at:  new Date().toISOString(),
    });

    // Look up employer for notification metadata
    const { data: employer } = await adminSupabase
      .from('employers')
      .select('user_id, company_name, contact_person, currency')
      .eq('id', employerId)
      .maybeSingle();

    if (employer?.user_id) {
      const currency = employer.currency ?? 'KES';
      await notifyEmployer({
        userId: employer.user_id,
        type: 'system',
        title: 'Top-Up Request Declined',
        message: `Your wallet top-up request of ${currency} ${Number(tx.amount).toLocaleString()} was not approved.${reason ? ` Reason: ${reason}` : ' Please contact support if you have questions.'}`,
        metadata: {
          wallet_transaction_id: id,
          amount: tx.amount,
          companyName: employer.company_name,
          contactPerson: employer.contact_person ?? undefined,
          reason: reason || undefined,
          newStatus: 'rejected',
          effectiveAt: new Date().toLocaleString(),
        },
      });
    }

    return NextResponse.json({ success: true, rejected: true, request_id: id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Admin TopUp Reject] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
