import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { dbErrorResponse } from '@/lib/api-errors';
import { sendEmail } from '@/lib/email-service';
import { AdminDigestEmail, type DigestPeriod } from '@/lib/emails/AdminNotifications';
import { convertToUSD } from '@/lib/utils';
import { DISBURSED_STATUSES } from '@/lib/constants/advance-status';
import { getEnv } from '@/env';

export const runtime = 'nodejs';

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  KE: 'KES',
  UG: 'UGX',
  TZ: 'TZS',
  RW: 'RWF',
};

function resolveCurrency(country?: string | null): string {
  return COUNTRY_TO_CURRENCY[(country ?? '').toUpperCase()] ?? 'KES';
}

// Sends the admin summary email that Admin Settings → Notifications' "Daily
// Summary Email" / "Weekly Report" toggles configure but never actually
// triggered anything for. Invoked by two separate cron schedules
// (.github/workflows/digest-emails.yml) — ?period=daily runs every morning,
// ?period=weekly runs once a week — both hitting this one route.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const period = (req.nextUrl.searchParams.get('period') ?? 'daily') as DigestPeriod;
  if (period !== 'daily' && period !== 'weekly') {
    return NextResponse.json({ error: "period must be 'daily' or 'weekly'" }, { status: 400 });
  }

  const env = getEnv();
  const supabaseAdmin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const { data: globalRow, error: settingsError } = await supabaseAdmin
      .from('global_settings')
      .select('notification_settings')
      .eq('id', 'default')
      .maybeSingle();

    if (settingsError) return dbErrorResponse('internal/send-digest-emails', settingsError);

    const ns = (globalRow?.notification_settings as { email_daily_summary?: boolean; email_weekly_report?: boolean; fraud_alert_emails?: string } | null) ?? {};
    const enabled = period === 'daily' ? ns.email_daily_summary !== false : ns.email_weekly_report !== false;

    if (!enabled) {
      return NextResponse.json({ ok: true, skipped: true, reason: `${period} summary disabled in settings` });
    }

    const rangeEnd = new Date();
    const rangeStart = new Date(rangeEnd);
    if (period === 'daily') {
      rangeStart.setDate(rangeStart.getDate() - 1);
    } else {
      rangeStart.setDate(rangeStart.getDate() - 7);
    }
    const rangeLabel = `${rangeStart.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })} – ${rangeEnd.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    const [
      { count: newEmployers, error: newEmployersError },
      { count: newEmployees, error: newEmployeesError },
      { count: pendingReviewRequests, error: reviewError },
      { count: pendingBankChanges, error: bankError },
      { count: openFraudAlerts, error: fraudError },
      { data: exchangeRates, error: ratesError },
      { data: advances, error: advancesError },
    ] = await Promise.all([
      supabaseAdmin.from('employers').select('id', { count: 'exact', head: true }).gte('created_at', rangeStart.toISOString()),
      supabaseAdmin.from('employees').select('id', { count: 'exact', head: true }).gte('created_at', rangeStart.toISOString()),
      supabaseAdmin.from('review_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('bank_change_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('fraud_alerts').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
      supabaseAdmin.from('exchange_rates').select('currency_code, rate_to_usd'),
      supabaseAdmin
        .from('advances')
        .select('amount, fee_amount, employees!advances_employee_id_fkey(country)')
        .in('status', DISBURSED_STATUSES)
        .gte('created_at', rangeStart.toISOString()),
    ]);

    for (const [label, error] of [
      ['newEmployers', newEmployersError], ['newEmployees', newEmployeesError],
      ['reviewRequests', reviewError], ['bankChanges', bankError],
      ['fraudAlerts', fraudError], ['exchangeRates', ratesError], ['advances', advancesError],
    ] as const) {
      if (error) return dbErrorResponse('internal/send-digest-emails', error, `Failed to load ${label}`);
    }

    const rates = (exchangeRates || []).reduce((acc: Record<string, number>, rate) => {
      if (rate.currency_code) acc[rate.currency_code.toUpperCase()] = Number(rate.rate_to_usd ?? 0);
      return acc;
    }, {} as Record<string, number>);

    type AdvRow = { amount: number | string | null; fee_amount: number | string | null; employees?: { country?: string | null } | null };
    const advRows = (advances ?? []) as AdvRow[];
    const totalDisbursedUsd = advRows.reduce((sum, a) => sum + convertToUSD(Number(a.amount || 0), resolveCurrency(a.employees?.country), rates), 0);
    const totalFeesUsd = advRows.reduce((sum, a) => sum + convertToUSD(Number(a.fee_amount || 0), resolveCurrency(a.employees?.country), rates), 0);

    const recipient = ns.fraud_alert_emails || env.ADMIN_NOTIFICATION_EMAIL || 'support@eaziwage.com';

    await sendEmail({
      to: recipient,
      subject: `[EaziWage] ${period === 'daily' ? 'Daily' : 'Weekly'} Summary — ${rangeLabel}`,
      react: AdminDigestEmail({
        period,
        rangeLabel,
        newEmployers: newEmployers ?? 0,
        newEmployees: newEmployees ?? 0,
        advancesCount: advRows.length,
        totalDisbursedUsd,
        totalFeesUsd,
        pendingReviews: (pendingReviewRequests ?? 0) + (pendingBankChanges ?? 0),
        openFraudAlerts: openFraudAlerts ?? 0,
      }),
    });

    return NextResponse.json({
      ok: true,
      period,
      sent_to: recipient,
      range: { from: rangeStart.toISOString(), to: rangeEnd.toISOString() },
    });
  } catch (err: unknown) {
    console.error('[send-digest-emails]', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
