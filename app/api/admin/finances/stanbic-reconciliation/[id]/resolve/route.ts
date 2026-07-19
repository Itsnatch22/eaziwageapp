import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { dbErrorResponse } from '@/lib/api-errors';
import { z } from 'zod';

const ResolveSchema = z.object({
  status: z.enum(['resolved', 'dismissed']),
  note: z.string().trim().max(1000).optional(),
});

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

    const raw = await request.json().catch(() => ({}));
    const parsed = ResolveSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 422 },
      );
    }
    const { status, note } = parsed.data;

    const { data: flag, error: flagError } = await adminSupabase
      .from('stanbic_deposit_reconciliation_flags')
      .select('id, wallet_transaction_id, status')
      .eq('id', id)
      .maybeSingle();

    if (flagError) throw flagError;
    if (!flag) return NextResponse.json({ error: 'Reconciliation flag not found' }, { status: 404 });
    if (flag.status !== 'pending_review') {
      return NextResponse.json({ error: `Flag is already ${flag.status}` }, { status: 409 });
    }

    const { error: updateError } = await adminSupabase
      .from('stanbic_deposit_reconciliation_flags')
      .update({
        status,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_note: note || null,
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // "resolved" means the admin confirmed the deposit is genuine (e.g.
    // checked the bank statement directly) — mark the underlying manual
    // deposit as reconciled too so it stops being re-evaluated on every sync.
    // "dismissed" leaves it unreconciled — the deposit itself is still in
    // question, only this particular flag is being closed out.
    if (status === 'resolved') {
      const { error: reconcileError } = await adminSupabase
        .from('admin_wallet_transactions')
        .update({ reconciled: true })
        .eq('id', flag.wallet_transaction_id);
      if (reconcileError) throw reconcileError;
    }

    void adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id,
      admin_name: user.email,
      target_id: flag.wallet_transaction_id,
      target_type: 'admin_wallet_transaction',
      action: 'stanbic_reconciliation_flag_resolved',
      old_value: { status: 'pending_review' },
      new_value: { status },
      metadata: { note },
    }).then(({ error }) => { if (error) console.error('[audit] stanbic_reconciliation_flag_resolved:', error); });

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    return dbErrorResponse('admin/finances/stanbic-reconciliation/resolve', err);
  }
}
