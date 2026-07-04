import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { dbErrorResponse } from '@/lib/api-errors';
import { notifyAdmin } from '@/lib/notifications';
import { getEnv } from '@/env';
import { isValidCronAuth } from '@/lib/cron-auth';

export const runtime = 'nodejs';

const FREQUENCY_DAYS: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  biannually: 180,
  annually: 365,
};

// Risk Settings > Verification Requirements' "Re-verification Frequency" was
// stored but never checked by anything. Run daily: finds approved employees
// whose KYC documents haven't been reviewed since the configured cutoff and
// notifies admin so they can request fresh documents. Deliberately does NOT
// change the employee's approval/EWA-access status — that's a much bigger,
// riskier behavior change than a reminder, and isn't what this setting
// historically implied.
export async function GET(req: Request) {
  if (!isValidCronAuth(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      .select('risk_settings')
      .eq('id', 'default')
      .maybeSingle();

    if (settingsError) return dbErrorResponse('internal/check-kyc-reverification', settingsError);

    const frequency = (globalRow?.risk_settings as { reverification_frequency?: string } | null)?.reverification_frequency ?? 'never';
    if (frequency === 'never' || !FREQUENCY_DAYS[frequency]) {
      return NextResponse.json({ ok: true, skipped: true, reason: `reverification_frequency is '${frequency}'` });
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - FREQUENCY_DAYS[frequency]);

    const { data: approvedEmployees, error: employeesError } = await supabaseAdmin
      .from('employee_onboarding')
      .select('user_id, full_name_placeholder, employer_id')
      .eq('status', 'approved');

    if (employeesError) return dbErrorResponse('internal/check-kyc-reverification', employeesError);

    const userIds = (approvedEmployees ?? []).map((e) => e.user_id).filter(Boolean) as string[];
    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, due: 0 });
    }

    // Most recent reviewed_at per user, across all their KYC documents.
    const { data: docs, error: docsError } = await supabaseAdmin
      .from('employee_kyc_documents')
      .select('user_id, reviewed_at')
      .in('user_id', userIds)
      .not('reviewed_at', 'is', null);

    if (docsError) return dbErrorResponse('internal/check-kyc-reverification', docsError);

    const lastReviewedByUser = new Map<string, string>();
    for (const doc of docs ?? []) {
      const existing = lastReviewedByUser.get(doc.user_id);
      if (!existing || new Date(doc.reviewed_at as string) > new Date(existing)) {
        lastReviewedByUser.set(doc.user_id, doc.reviewed_at as string);
      }
    }

    const due = (approvedEmployees ?? []).filter((e) => {
      const lastReviewed = lastReviewedByUser.get(e.user_id);
      // No review record at all — treat as overdue rather than skip silently.
      return !lastReviewed || new Date(lastReviewed) < cutoff;
    });

    if (due.length === 0) {
      return NextResponse.json({ ok: true, due: 0 });
    }

    await notifyAdmin({
      type: 'system_alert',
      title: `KYC Re-verification Due — ${due.length} Employee${due.length === 1 ? '' : 's'}`,
      message: `${due.length} approved employee${due.length === 1 ? ' has' : 's have'} not had KYC documents reviewed in over ${FREQUENCY_DAYS[frequency]} days (${frequency} re-verification policy). Request fresh documents from the KYC review dashboard.`,
      metadata: {
        frequency,
        cutoff_days: FREQUENCY_DAYS[frequency],
        due_count: due.length,
        user_ids: due.map((e) => e.user_id),
      },
    });

    return NextResponse.json({ ok: true, due: due.length, frequency });
  } catch (err: unknown) {
    console.error('[check-kyc-reverification]', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
