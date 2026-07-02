import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { resolveEffectivePaydayDayOfMonth } from '@/lib/repayment/utils';

export const runtime = 'nodejs';

// Clamp a target day-of-month to however many days that month actually has —
// mirrors lib/services/payout-service.ts's clampDayToMonth so "is today payday"
// and "when is the due date" agree on the same effective date.
function clampDayToMonth(year: number, monthIndex: number, day: number): number {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(day, lastDay);
}

export async function GET() {
  const supabase = await createRouteHandlerClient();
  const adminSupabase = createAdminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: employer } = await supabase
    .from('employers')
    .select('id, payday_day_of_month')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!employer) {
    return NextResponse.json({ recoupment: null });
  }

  const paydayDayOfMonth = await resolveEffectivePaydayDayOfMonth(
    employer.id,
    employer.payday_day_of_month,
    adminSupabase,
  );

  if (!paydayDayOfMonth) {
    return NextResponse.json({ recoupment: null });
  }

  const today = new Date();
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const effectivePaydayDate = new Date(
    todayDateOnly.getFullYear(),
    todayDateOnly.getMonth(),
    clampDayToMonth(todayDateOnly.getFullYear(), todayDateOnly.getMonth(), paydayDayOfMonth),
  );
  const isPaydayToday = todayDateOnly.getTime() === effectivePaydayDate.getTime();
  const todayStr = todayDateOnly.toISOString().split('T')[0];

  // Any not-yet-resolved row (from today or a past cycle) keeps surfacing until
  // acted on — an employer shouldn't be able to make a prompt disappear by just
  // waiting for the day to pass. Past-cycle unresolved rows feed the arrears
  // gate on new advance requests (see the eligibility check in payout-service.ts).
  const { data: existing } = await adminSupabase
    .from('payday_recoupments')
    .select('*')
    .eq('employer_id', employer.id)
    .in('status', ['pending_response', 'confirmed', 'collecting', 'failed'])
    .order('payday_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ recoupment: existing });
  }

  if (!isPaydayToday) {
    return NextResponse.json({ recoupment: null });
  }

  const { data: dueSchedules } = await adminSupabase
    .from('repayment_schedules')
    .select('repayment_amount, currency')
    .eq('employer_id', employer.id)
    .in('status', ['pending', 'overdue']);

  const amountDue = (dueSchedules ?? []).reduce((sum, s) => sum + Number(s.repayment_amount || 0), 0);
  if (amountDue <= 0) {
    return NextResponse.json({ recoupment: null });
  }

  const currency = dueSchedules?.[0]?.currency || 'KES';

  const { data: created, error: createError } = await adminSupabase
    .from('payday_recoupments')
    .insert({
      employer_id: employer.id,
      payday_date: todayStr,
      amount_due: amountDue,
      currency,
      status: 'pending_response',
    })
    .select('*')
    .single();

  if (createError) {
    // The (employer_id, payday_date) unique constraint racing with a concurrent
    // request/tab is the only expected failure here — re-fetch instead of erroring.
    const { data: raced } = await adminSupabase
      .from('payday_recoupments')
      .select('*')
      .eq('employer_id', employer.id)
      .eq('payday_date', todayStr)
      .maybeSingle();
    return NextResponse.json({ recoupment: raced ?? null });
  }

  return NextResponse.json({ recoupment: created });
}
