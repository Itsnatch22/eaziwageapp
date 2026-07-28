import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { dbErrorResponse } from '@/lib/api-errors';
import { notifyAdmin, notifyEmployer } from '@/lib/notifications';

export const runtime = 'nodejs';

interface TopupTx {
  id: string;
  wallet_id: string;
  amount: number;
  type: string;
  status: string;
  reference: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  local_currency: string | null;
  usd_amount: number | null;
  rate_snapshot: number | null;
}

interface EmployerRow {
  id: string;
  user_id: string | null;
  company_name: string | null;
  contact_person: string | null;
  currency: string | null;
  country: string | null;
  funding_model: string | null;
}

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

    const { data: tx, error: txError } = await adminSupabase
      .from('wallet_transactions')
      .select('id, wallet_id, amount, type, status, reference, description, metadata, local_currency, usd_amount, rate_snapshot')
      .eq('id', id)
      .maybeSingle() as { data: TopupTx | null; error: unknown };

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

    const { data: employer, error: employerErr } = await adminSupabase
      .from('employers')
      .select('id, user_id, company_name, contact_person, country, funding_model')
      .eq('id', employerId)
      .maybeSingle() as { data: EmployerRow | null; error: unknown };

    if (employerErr) throw employerErr;
    if (!employer) return NextResponse.json({ error: 'Employer not found' }, { status: 404 });

    // Jason confirmed EaziWage never sends cash to an employer account. Approval
    // is therefore a ledger-only credit-line operation: no DusuPay collection,
    // no DusuPay payout, and no admin_wallet cash movement.
    const { error: rpcError } = await adminSupabase.rpc('approve_employer_credit_line', {
      p_employer_id: employerId,
      p_amount: Number(tx.amount),
      p_currency: tx.local_currency || employer.currency || 'KES',
      p_wallet_transaction_id: id,
      p_admin_id: user.id,
    });

    if (rpcError) throw rpcError;

    void adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id,
      admin_name: user.email,
      target_id: id,
      target_type: 'wallet_transaction',
      action: 'topup_ledger_approved',
      old_value: { status: 'pending' },
      new_value: { status: 'completed' },
      metadata: { employer_id: employerId, amount: tx.amount, currency: tx.local_currency || employer.currency || 'KES', funding_model: employer.funding_model },
    }).then(({ error }) => { if (error) console.error('[audit] topup_ledger_approved:', error); });

    if (employer.user_id) {
      void notifyEmployer({
        userId: employer.user_id,
        type: 'wallet_topup_approved',
        title: 'Credit Line Approved',
        message: `Your EaziWage credit line request of ${tx.local_currency || employer.currency || 'KES'} ${Number(tx.amount).toLocaleString()} has been approved.`,
        metadata: { wallet_transaction_id: id, amount: tx.amount, currency: tx.local_currency || employer.currency || 'KES', companyName: employer.company_name },
      }).catch(() => {});
    }

    void notifyAdmin({
      type: 'system_alert',
      title: 'Employer Credit Line Approved',
      message: `Approved ${employer.company_name || employerId} for ${tx.local_currency || employer.currency || 'KES'} ${Number(tx.amount).toLocaleString()} as a ledger-only credit-line update. No DusuPay employer payout was initiated.`,
      metadata: { wallet_transaction_id: id, employer_id: employerId, amount: tx.amount },
    }).catch(() => {});

    return NextResponse.json({ success: true, completed: true, request_id: id });
  } catch (err: unknown) {
    return dbErrorResponse('admin/wallet/topup-requests/approve', err);
  }
}
