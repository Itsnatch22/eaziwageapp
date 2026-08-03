import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { payoutService } from '@/lib/services/payout-service';
import { notifyAdmin } from '@/lib/notifications';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  context: AppRouteContext<{ id: string }>,
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const { id } = await context.params;

  const { data: advance, error: fetchError } = await supabaseAdmin
    .from('advances')
    .select('id, status, employee_id, employer_id, amount')
    .eq('id', id)
    .maybeSingle();

  if (fetchError || !advance) {
    return NextResponse.json({ error: 'Advance not found' }, { status: 404 });
  }

  if (advance.status !== 'failed') {
    return NextResponse.json(
      { error: `Cannot retry disbursement for advance with status '${advance.status}'. Only failed advances can be retried.` },
      { status: 409 },
    );
  }

  // Reset to approved so disburseAdvance can claim it
  const { error: resetError } = await supabaseAdmin
    .from('advances')
    .update({ status: 'approved', reason: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'failed');

  if (resetError) {
    return NextResponse.json({ error: 'Failed to reset advance status' }, { status: 500 });
  }

  // Audit the manual retry
  void supabaseAdmin.from('system_audit_logs').insert({
    admin_id: user.id,
    admin_name: user.email ?? user.id,
    target_id: id,
    target_type: 'advance',
    action: 'advance_disbursement_retry',
    old_value: { status: 'failed' },
    new_value: { status: 'approved' },
    metadata: { employee_id: advance.employee_id, employer_id: advance.employer_id, amount: advance.amount },
  });

  try {
    const result = await payoutService.disburseAdvance(id);
    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'Retry disbursement failed';
    console.error(`[retry-disbursement] Disbursement failed again for ${id}:`, reason);

    await supabaseAdmin
      .from('advances')
      .update({ status: 'failed', reason })
      .eq('id', id)
      .in('status', ['approved', 'processing']);

    void notifyAdmin({
      type: 'system_alert',
      title: 'Advance Retry Failed',
      message: `Manual retry of advance ${id} failed again: ${reason}. Further investigation required.`,
      metadata: { advance_id: id, employer_id: advance.employer_id, reason, retried_by: user.id },
    }).catch(() => {});

    return NextResponse.json({ error: reason }, { status: 500 });
  }
}
