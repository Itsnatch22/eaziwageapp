import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAndCreatePaydayRecoupment } from '@/lib/services/payday-recoupment-service';
import { isValidCronAuth } from '@/lib/cron-auth';

export const runtime = 'nodejs';

// Runs daily. Previously, payday recoupment only ever fired as a side effect of
// an employer happening to load a dashboard page on their exact payday — if no
// one from that company logged in that day, the check never ran, and there was
// no automated way to catch up afterward. This iterates every employer and lets
// checkAndCreatePaydayRecoupment decide (per-employer) whether today matches
// their effective payday.
async function run(): Promise<NextResponse> {
  try {
    const { data: employers, error } = await supabaseAdmin
      .from('employers')
      .select('id, user_id, company_name, payday_day_of_month, recoupment_method')
      .not('payday_day_of_month', 'is', null);

    if (error) {
      console.error('[cron/payday-recoupment] employer fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch employers' }, { status: 500 });
    }

    const employerList = employers ?? [];
    const employerIds = employerList.map(e => e.id);

    // Batch query latest processed payroll run for all employers to avoid N+1 DB calls
    const { data: payrollUploads } = employerIds.length > 0
      ? await supabaseAdmin
          .from('payroll_uploads')
          .select('employer_live_id, processed_at')
          .in('employer_live_id', employerIds)
          .eq('status', 'processed')
          .not('processed_at', 'is', null)
          .order('processed_at', { ascending: false })
      : { data: [] };

    const effectivePaydayMap = new Map<string, number>();
    for (const upload of payrollUploads ?? []) {
      if (upload.employer_live_id && !effectivePaydayMap.has(upload.employer_live_id) && upload.processed_at) {
        effectivePaydayMap.set(upload.employer_live_id, new Date(upload.processed_at).getDate());
      }
    }

    let created = 0;
    let checked = 0;
    const failures: Array<{ employer_id: string; error: string }> = [];

    for (const employer of employerList) {
      checked++;
      try {
        const effectivePayday = effectivePaydayMap.get(employer.id) ?? employer.payday_day_of_month;
        const recoupment = await checkAndCreatePaydayRecoupment(
          employer.id,
          employer.user_id,
          employer.company_name,
          employer.payday_day_of_month,
          employer.recoupment_method,
          effectivePayday,
        );
        if (recoupment) created++;
      } catch (err) {
        console.error('[cron/payday-recoupment] Failed for employer:', employer.id, err);
        failures.push({ employer_id: employer.id, error: err instanceof Error ? err.message : String(err) });
      }
    }

    console.log(`[cron/payday-recoupment] Checked ${checked} employers, ${created} recoupment(s) due today, ${failures.length} failure(s)`);
    return NextResponse.json({ checked, created, failures });
  } catch (err) {
    console.error('[cron/payday-recoupment] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function authorize(req: NextRequest): boolean {
  return isValidCronAuth(req.headers.get('authorization'));
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
