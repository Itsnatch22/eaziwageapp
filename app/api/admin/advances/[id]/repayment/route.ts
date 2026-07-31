import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyEmployer } from '@/lib/notifications';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  context: AppRouteContext<{ id: string }>,
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const { id } = await context.params;

  // 1. Verify advance exists and is completed
  const { data: advance, error: advanceError } = await supabaseAdmin
    .from('advances')
    .select('id, status, employer_id, employee_id, amount, currency')
    .eq('id', id)
    .maybeSingle();

  if (advanceError || !advance) {
    return NextResponse.json({ error: 'Advance not found' }, { status: 404 });
  }

  if (!['completed', 'disbursed'].includes(advance.status)) {
    return NextResponse.json(
      { error: `Cannot mark repaid: advance status is '${advance.status}', expected 'completed' or 'disbursed'.` },
      { status: 409 },
    );
  }

  // 2. Verify repayment schedule exists and is not already paid — CRITICAL idempotency guard
  const { data: schedule, error: scheduleError } = await supabaseAdmin
    .from('repayment_schedules')
    .select('id, status, repayment_amount, employer_id')
    .eq('advance_id', id)
    .maybeSingle();

  if (scheduleError) {
    return NextResponse.json({ error: 'Failed to fetch repayment schedule' }, { status: 500 });
  }

  if (!schedule) {
    return NextResponse.json({ error: 'No repayment schedule found for this advance' }, { status: 404 });
  }

  if (schedule.status === 'paid') {
    return NextResponse.json({ error: 'Repayment schedule already marked as paid' }, { status: 409 });
  }

  const amount = Number(advance.amount);

  // 3. Call repay_advance_to_admin RPC — the single source of financial truth
  const { error: rpcError } = await supabaseAdmin.rpc('repay_advance_to_admin', {
    p_advance_id: id,
    p_amount: amount,
  });

  if (rpcError) {
    console.error('[admin/repayment] repay_advance_to_admin RPC failed:', rpcError);
    return NextResponse.json({ error: `Repayment RPC failed: ${rpcError.message}` }, { status: 500 });
  }

  const now = new Date().toISOString();

  // 4. Update repayment schedule — RPC succeeded, safe to record
  await supabaseAdmin
    .from('repayment_schedules')
    .update({
      status: 'paid',
      paid_amount: amount,
      paid_at: now,
      updated_at: now,
    })
    .eq('id', schedule.id);

  // 5. Update employer wallet totals
  const { data: wallet } = await supabaseAdmin
    .from('employer_wallets')
    .select('total_repaid, outstanding_liability')
    .eq('employer_id', advance.employer_id)
    .maybeSingle();

  if (wallet) {
    await supabaseAdmin
      .from('employer_wallets')
      .update({
        total_repaid: Number(wallet.total_repaid ?? 0) + amount,
        outstanding_liability: Math.max(0, Number(wallet.outstanding_liability ?? 0) - amount),
        updated_at: now,
      })
      .eq('employer_id', advance.employer_id);
  }

  // 6. Audit trail — CBK 5-year retention
  void supabaseAdmin.from('system_audit_logs').insert({
    admin_id: user.id,
    admin_name: user.email ?? user.id,
    target_id: id,
    target_type: 'advance',
    action: 'advance_repaid_manual',
    old_value: { schedule_status: schedule.status },
    new_value: { schedule_status: 'paid', paid_amount: amount },
    metadata: {
      schedule_id: schedule.id,
      employer_id: advance.employer_id,
      employee_id: advance.employee_id,
      amount,
      currency: advance.currency,
    },
  });

  // 7. Notify employer — fire-and-forget
  void (async () => {
    try {
      const { data: employer } = await supabaseAdmin
        .from('employers')
        .select('user_id, company_name')
        .eq('id', advance.employer_id)
        .maybeSingle();

      if (employer?.user_id) {
        await notifyEmployer({
          userId: employer.user_id,
          type: 'system',
          title: 'Repayment Confirmed',
          message: `Your advance repayment of ${advance.currency ?? 'KES'} ${amount.toLocaleString()} has been confirmed and reconciled.`,
          metadata: {
            advance_id: id,
            schedule_id: schedule.id,
            amount,
            currency: advance.currency,
            companyName: employer.company_name,
          },
        });
      }
    } catch (notifyErr) {
      console.error('[admin/repayment] Employer notification failed (non-fatal):', notifyErr);
    }
  })();

  return NextResponse.json({ success: true });
}
