import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyAdmin } from '@/lib/notifications';

async function run(): Promise<NextResponse> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: overdueSchedules, error: fetchError } = await supabaseAdmin
      .from('repayment_schedules')
      .select(`
        id, advance_id, employer_id, repayment_amount, currency,
        due_date, repayment_reference, overdue_notified_at,
        employers!employer_id ( company_name )
      `)
      .eq('status', 'pending')
      .lt('due_date', today);

    if (fetchError) {
      console.error('[cron/repayment-overdue] Fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!overdueSchedules?.length) {
      return NextResponse.json({ processed: 0, newly_overdue: 0 });
    }

    const ids = overdueSchedules.map((s) => s.id);

    const { error: updateError } = await supabaseAdmin
      .from('repayment_schedules')
      .update({ status: 'overdue', updated_at: new Date().toISOString() })
      .in('id', ids);

    if (updateError) {
      console.error('[cron/repayment-overdue] Bulk update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    let notified = 0;
    for (const schedule of overdueSchedules) {
      if (schedule.overdue_notified_at) continue; // already notified — skip

      const employer = schedule.employers as { company_name?: string } | null;
      const employerName = employer?.company_name ?? schedule.employer_id;

      try {
        await notifyAdmin({
          type: 'system_alert',
          title: `⚠️ Overdue Repayment — ${employerName}`,
          message: `Advance ${schedule.advance_id} repayment of ${schedule.currency} ${schedule.repayment_amount} was due on ${schedule.due_date} and has not been received. Reference: ${schedule.repayment_reference}`,
          metadata: {
            repayment_schedule_id: schedule.id,
            advance_id:            schedule.advance_id,
            employer_id:           schedule.employer_id,
            due_date:              schedule.due_date,
            amount:                schedule.repayment_amount,
            reference:             schedule.repayment_reference,
          },
        });

        await supabaseAdmin
          .from('repayment_schedules')
          .update({ overdue_notified_at: new Date().toISOString() })
          .eq('id', schedule.id);

        notified++;
      } catch (notifyErr) {
        console.error('[cron/repayment-overdue] Notify failed for schedule:', schedule.id, notifyErr);
      }
    }

    console.log(`[cron/repayment-overdue] Marked ${ids.length} overdue, notified ${notified}`);
    return NextResponse.json({ processed: ids.length, newly_overdue: ids.length, notified });
  } catch (err) {
    console.error('[cron/repayment-overdue] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function authorize(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? '';
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

// Vercel Cron sends GET; internal callers may POST
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return run();
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return run();
}
