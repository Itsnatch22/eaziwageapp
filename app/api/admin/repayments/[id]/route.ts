import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { notifyEmployer } from '@/lib/notifications';

const PatchSchema = z.object({
  action:      z.enum(['mark_paid', 'mark_waived', 'send_reminder']),
  paid_amount: z.number().positive().optional(),
  notes:       z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const rateLimitResponse = await checkAdminRateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { user, adminSupabase } = auth;

  const { id } = await params;

  const raw = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }
  const { action, paid_amount, notes } = parsed.data;

  const { data: schedule, error: fetchError } = await adminSupabase
    .from('repayment_schedules')
    .select(`
      id, advance_id, employer_id, employee_id,
      repayment_amount, currency, status, repayment_reference,
      employers!employer_id ( user_id, company_name )
    `)
    .eq('id', id)
    .maybeSingle();

  if (fetchError || !schedule) {
    return NextResponse.json({ error: 'Repayment schedule not found' }, { status: 404 });
  }

  const employer = schedule.employers as { user_id?: string; company_name?: string } | null;

  // ─── Send Reminder ───────────────────────────────────────────────────────────
  if (action === 'send_reminder') {
    if (!employer?.user_id) {
      return NextResponse.json({ error: 'Employer user_id not found' }, { status: 422 });
    }
    const isOverdue = schedule.status === 'overdue';
    await notifyEmployer({
      userId: employer.user_id,
      type:   'system',
      title:  isOverdue ? 'Overdue Repayment Reminder' : 'Repayment Due Soon',
      message: `This is a reminder that advance repayment of ${schedule.currency} ${schedule.repayment_amount} (reference: ${schedule.repayment_reference}) is ${isOverdue ? 'overdue' : 'due soon'}. Please ensure funds are transferred promptly.`,
      metadata: {
        schedule_id: id,
        advance_id:  schedule.advance_id,
        amount:      schedule.repayment_amount,
        currency:    schedule.currency,
        reference:   schedule.repayment_reference,
      },
    });
    return NextResponse.json({ success: true, action: 'reminder_sent' });
  }

  // ─── Mark Waived ─────────────────────────────────────────────────────────────
  if (action === 'mark_waived') {
    if (schedule.status === 'paid') {
      return NextResponse.json({ error: 'Cannot waive an already-paid schedule' }, { status: 409 });
    }
    const { error: waivedError } = await adminSupabase
      .from('repayment_schedules')
      .update({ status: 'waived', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (waivedError) {
      return NextResponse.json({ error: 'Failed to waive repayment' }, { status: 500 });
    }

    void adminSupabase.from('system_audit_logs').insert({
      admin_id:    user.id,
      admin_name:  user.email,
      target_id:   id,
      target_type: 'repayment_schedule',
      action:      'repayment_waived',
      old_value:   { status: schedule.status },
      new_value:   { status: 'waived' },
      metadata:    { notes, reference: schedule.repayment_reference },
    });

    return NextResponse.json({ success: true, status: 'waived' });
  }

  // ─── Mark Paid ───────────────────────────────────────────────────────────────
  if (schedule.status === 'paid') {
    return NextResponse.json({ error: 'Schedule is already marked paid' }, { status: 409 });
  }

  const finalAmount = paid_amount ?? Number(schedule.repayment_amount);

  // Financial integrity: call RPC before touching schedule row.
  const { error: rpcError } = await adminSupabase.rpc('repay_advance_to_admin', {
    p_advance_id: schedule.advance_id,
    p_amount:     finalAmount,
  });

  if (rpcError) {
    console.error('[PATCH /repayments/[id]] repay_advance_to_admin failed:', rpcError);
    return NextResponse.json({ error: `Repayment RPC failed: ${rpcError.message}` }, { status: 500 });
  }

  const { error: scheduleError } = await adminSupabase
    .from('repayment_schedules')
    .update({
      status:      'paid',
      paid_amount: finalAmount,
      paid_at:     new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    })
    .eq('id', id);

  if (scheduleError) {
    // RPC already ran — financial state is correct. Log for reconciliation.
    console.error('[PATCH /repayments/[id]] Schedule update failed after RPC:', scheduleError);
  }

  void adminSupabase.from('system_audit_logs').insert({
    admin_id:    user.id,
    admin_name:  user.email,
    target_id:   id,
    target_type: 'repayment_schedule',
    action:      'repayment_marked_paid',
    old_value:   { status: schedule.status },
    new_value:   { status: 'paid', paid_amount: finalAmount },
    metadata:    { notes, reference: schedule.repayment_reference },
  });

  if (employer?.user_id) {
    void notifyEmployer({
      userId:  employer.user_id,
      type:    'system',
      title:   'Repayment Confirmed',
      message: `Your advance repayment of ${schedule.currency} ${finalAmount} (reference: ${schedule.repayment_reference}) has been confirmed and recorded.`,
      metadata: {
        schedule_id: id,
        advance_id:  schedule.advance_id,
        amount:      finalAmount,
        currency:    schedule.currency,
        reference:   schedule.repayment_reference,
      },
    });
  }

  return NextResponse.json({ success: true, status: 'paid', paid_amount: finalAmount });
}
