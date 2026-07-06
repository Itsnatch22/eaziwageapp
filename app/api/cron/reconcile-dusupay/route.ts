import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { dusupay } from '@/lib/dusupay';
import { notifyAdmin } from '@/lib/notifications';
import { isValidCronAuth } from '@/lib/cron-auth';

export const runtime = 'nodejs';

// How far back to look. Advances older than this either already settled long
// ago (and a mismatch there is a historical data question, not an active
// money-integrity risk) or were never disbursed at all.
const LOOKBACK_DAYS = 7;
// Cap per run so this never hammers DusuPay's API — a single AWS/Vercel cron
// run should stay well under any reasonable third-party rate limit.
const MAX_PER_RUN = 100;
// Small delay between DusuPay calls, same reasoning as MAX_PER_RUN.
const DELAY_MS = 150;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mirrors the exact status-mapping logic in the webhook handler
// (handlePayoutEvent, app/api/webhook/dusupay/route.ts) and the verify route
// — kept as its own copy here deliberately: this job only ever *reads* DusuPay
// status to compare, never writes based on it, so it doesn't share the
// terminal-status-guard concern those two do.
function mapDusupayStatus(status: string | undefined | null): 'completed' | 'failed' | 'processing' | null {
  if (!status) return null;
  if (status === 'COMPLETED') return 'completed';
  if (status === 'FAILED' || status === 'CANCELLED') return 'failed';
  return 'processing';
}

interface AdvanceRow {
  id: string;
  reference: string | null;
  status: string;
}

async function run(): Promise<NextResponse> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: advances, error } = await supabaseAdmin
    .from('advances')
    .select('id, reference, status')
    .in('status', ['processing', 'completed', 'failed'])
    .not('reference', 'is', null)
    .gte('updated_at', since)
    .limit(MAX_PER_RUN);

  if (error) {
    console.error('[reconcile-dusupay] Failed to fetch advances:', error);
    return NextResponse.json({ error: 'Failed to fetch advances' }, { status: 500 });
  }

  const rows = (advances ?? []) as AdvanceRow[];
  let checked = 0;
  let mismatches = 0;
  const mismatchDetails: Array<{ advanceId: string; supabaseStatus: string; dusupayStatus: string | null }> = [];

  for (const advance of rows) {
    if (!advance.reference) continue;
    checked++;

    let result;
    try {
      result = await dusupay.checkPayoutStatus(advance.reference);
    } catch (err) {
      console.error('[reconcile-dusupay] Status check threw', { advanceId: advance.id, err });
      continue;
    }

    if (!result.success) {
      // DusuPay couldn't answer for this reference at all — worth knowing about,
      // but not the same as a confirmed status disagreement.
      continue;
    }

    const dusupayMapped = mapDusupayStatus(result.status);
    if (dusupayMapped && dusupayMapped !== advance.status) {
      mismatches++;
      mismatchDetails.push({ advanceId: advance.id, supabaseStatus: advance.status, dusupayStatus: result.status ?? null });

      const { error: insertError } = await supabaseAdmin
        .from('dusupay_reconciliation_mismatches')
        .insert({
          advance_id: advance.id,
          merchant_reference: advance.reference,
          supabase_status: advance.status,
          dusupay_status: result.status ?? null,
          dusupay_raw: result.raw ?? null,
        });

      if (insertError) {
        console.error('[reconcile-dusupay] Failed to record mismatch', { advanceId: advance.id, insertError });
      }
    }

    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  if (mismatches > 0) {
    void notifyAdmin({
      type: 'system_alert',
      title: `DusuPay reconciliation: ${mismatches} mismatch(es) found`,
      message: `Checked ${checked} advances against DusuPay's live status — ${mismatches} disagree with Supabase's recorded status. Review in dusupay_reconciliation_mismatches before assuming either side is correct.`,
      metadata: { checked, mismatches, mismatchDetails: mismatchDetails.slice(0, 20) },
    }).catch((err) => console.error('[reconcile-dusupay] notifyAdmin failed:', err));
  }

  console.log(`[reconcile-dusupay] Checked ${checked}/${rows.length} advances, ${mismatches} mismatch(es)`);
  return NextResponse.json({ checked, total: rows.length, mismatches });
}

function authorize(req: NextRequest): boolean {
  return isValidCronAuth(req.headers.get('authorization'));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return run();
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return run();
}
