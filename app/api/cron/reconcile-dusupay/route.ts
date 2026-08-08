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
  employer_id?: string | null;
  amount?: number | null;
}

interface WalletTxRow {
  id: string;
  reference: string | null;
  status: string;
}

// Employer wallet top-up 'processing' rows (DEP- collection, EWA-FUND- payout)
// need the same reconciliation coverage as advances — a missed webhook would
// otherwise leave one stuck in 'processing' forever with no employer credit
// and no admin visibility. Mirrors the advances loop below; the only
// meaningful mismatch here is "DusuPay says this reached a terminal state but
// our DB still shows processing", since 'processing' is the only non-terminal
// wallet_transactions status this reconciliation job cares about.
async function reconcileWalletTopups(log: (msg: string) => void): Promise<{ checked: number; mismatches: number }> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id, reference, status')
    .eq('status', 'processing')
    .not('reference', 'is', null)
    .gte('created_at', since)
    .limit(MAX_PER_RUN);

  if (error) {
    console.error('[reconcile-dusupay] Failed to fetch wallet_transactions:', error);
    return { checked: 0, mismatches: 0 };
  }

  const walletRows = ((rows ?? []) as WalletTxRow[]).filter(
    (r) => r.reference && (r.reference.startsWith('DEP-') || r.reference.startsWith('EWA-FUND-')),
  );

  let checked = 0;
  let mismatches = 0;

  for (const tx of walletRows) {
    if (!tx.reference) continue;
    checked++;

    let result;
    try {
      result = await dusupay.checkPayoutStatus(tx.reference);
    } catch (err) {
      console.error('[reconcile-dusupay] Wallet tx status check threw', { txId: tx.id, err });
      continue;
    }

    if (!result.success) {
      continue;
    }

    const dusupayMapped = mapDusupayStatus(result.status);
    // Only a confirmed terminal DusuPay status (completed/failed) that
    // disagrees with our still-'processing' row counts as a mismatch worth
    // recording — DusuPay's own 'processing'/pending states agreeing with
    // ours isn't news.
    if (dusupayMapped && dusupayMapped !== 'processing' && dusupayMapped !== tx.status) {
      mismatches++;

      const { error: insertError } = await supabaseAdmin
        .from('dusupay_reconciliation_mismatches')
        .insert({
          wallet_transaction_id: tx.id,
          merchant_reference: tx.reference,
          supabase_status: tx.status,
          dusupay_status: result.status ?? null,
          dusupay_raw: result.raw ?? null,
        });

      if (insertError) {
        console.error('[reconcile-dusupay] Failed to record wallet tx mismatch', { txId: tx.id, insertError });
      }
    }

    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  if (mismatches > 0) {
    void notifyAdmin({
      type: 'system_alert',
      title: `DusuPay reconciliation: ${mismatches} wallet top-up mismatch(es) found`,
      message: `Checked ${checked} processing wallet top-ups against DusuPay's live status — ${mismatches} had actually reached a terminal state DusuPay-side without our webhook catching it. Review in dusupay_reconciliation_mismatches.`,
      metadata: { checked, mismatches },
    }).catch((err) => console.error('[reconcile-dusupay] notifyAdmin failed:', err));
  }

  log(`[reconcile-dusupay] Wallet top-ups: checked ${checked}/${walletRows.length}, ${mismatches} mismatch(es)`);
  return { checked, mismatches };
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

  // New reconciliation passes per ranked-fixes: handle disbursed_pending_ledger
  // (retry ledger RPC) and processing_unknown (indeterminate send/verify network failures).
  async function processDisbursedPendingLedger(log: (msg: string) => void): Promise<{ checked: number; resolved: number; unresolved: number }> {
    const { data: rows2, error: fetchError } = await supabaseAdmin
      .from('advances')
      .select('id, reference, amount, currency, employer_id, internal_reference')
      .eq('status', 'disbursed_pending_ledger')
      .gte('updated_at', since)
      .limit(MAX_PER_RUN);

    if (fetchError) {
      console.error('[reconcile-dusupay] Failed to fetch disbursed_pending_ledger advances:', fetchError);
      return { checked: 0, resolved: 0, unresolved: 0 };
    }

    const advances = (rows2 ?? []) as Array<{ id: string; reference?: string | null; amount?: number | null; currency?: string | null; employer_id?: string | null; internal_reference?: string | null }>;
    let checked2 = 0;
    let resolved2 = 0;
    let unresolved2 = 0;

    for (const adv of advances) {
      checked2++;
      try {
        // Call idempotent RPC to record the ledger debit. Use whatever fields we have.
        const { error: rpcError } = await supabaseAdmin.rpc('record_employee_disbursement_from_treasury', {
          p_advance_id: adv.id,
          p_amount: adv.amount ?? 0,
          p_country_code: null,
          p_currency: adv.currency ?? null,
          p_reference: adv.reference ?? null,
          p_internal_reference: adv.internal_reference ?? null,
        });

        if (rpcError) {
          console.error('[reconcile-dusupay] record_employee_disbursement_from_treasury retry failed', { advanceId: adv.id, rpcError });
          unresolved2++;
          continue;
        }

        // Mark advance completed now that treasury RPC succeeded
        const { error: updateError } = await supabaseAdmin
          .from('advances')
          .update({ status: 'completed', disbursed_at: new Date().toISOString() })
          .eq('id', adv.id);

        if (updateError) {
          console.error('[reconcile-dusupay] Failed to mark advance completed after successful treasury RPC', { advanceId: adv.id, updateError });
          unresolved2++;
          continue;
        }

        resolved2++;
      } catch (err) {
        console.error('[reconcile-dusupay] Error processing disbursed_pending_ledger advance', { advanceId: adv.id, err });
        unresolved2++;
      }

      if (DELAY_MS > 0) await sleep(DELAY_MS);
    }

    if (unresolved2 > 0) {
      void notifyAdmin({
        type: 'system_alert',
        title: `DusuPay reconciliation: ${unresolved2} disbursed_pending_ledger advances still unresolved`,
        message: `${unresolved2} advances remain in disbursed_pending_ledger after retry attempts. Manual investigation required.`,
        metadata: { unresolved: unresolved2 },
      }).catch((err) => console.error('[reconcile-dusupay] notifyAdmin failed:', err));
    }

    log(`[reconcile-dusupay] disbursed_pending_ledger: checked ${checked2}, resolved ${resolved2}, unresolved ${unresolved2}`);
    return { checked: checked2, resolved: resolved2, unresolved: unresolved2 };
  }

  async function processProcessingUnknown(log: (msg: string) => void): Promise<{ checked: number; resolved: number; unresolved: number }> {
    const { data: rows3, error: fetchError } = await supabaseAdmin
      .from('advances')
      .select('id, reference, amount, employer_id')
      .eq('status', 'processing_unknown')
      .gte('updated_at', since)
      .limit(MAX_PER_RUN);

    if (fetchError) {
      console.error('[reconcile-dusupay] Failed to fetch processing_unknown advances:', fetchError);
      return { checked: 0, resolved: 0, unresolved: 0 };
    }

    const advances = (rows3 ?? []) as Array<{ id: string; reference?: string | null; amount?: number | null; employer_id?: string | null }>;
    let checked3 = 0;
    let resolved3 = 0;
    let unresolved3 = 0;

    for (const adv of advances) {
      if (!adv.reference) {
        unresolved3++;
        continue;
      }
      checked3++;

      let result;
      try {
        result = await dusupay.checkPayoutStatus(adv.reference);
      } catch (err) {
        console.error('[reconcile-dusupay] checkPayoutStatus threw for processing_unknown', { advanceId: adv.id, err });
        unresolved3++;
        continue;
      }

      if (!result.success) {
        // Still indeterminate
        unresolved3++;
        continue;
      }

      const mapped = mapDusupayStatus(result.status);
      if (mapped === 'completed') {
        // Move to disbursed_pending_ledger so the ledger-RPC pass can settle it
        const { error: updateError } = await supabaseAdmin
          .from('advances')
          .update({ status: 'disbursed_pending_ledger', reference: adv.reference, internal_reference: result.internalReference ?? null })
          .eq('id', adv.id);

        if (updateError) {
          console.error('[reconcile-dusupay] Failed to mark processing_unknown -> disbursed_pending_ledger', { advanceId: adv.id, updateError });
          unresolved3++;
          continue;
        }

        resolved3++;
      } else if (mapped === 'failed') {
        // Money did not move — mark failed and release employer reservation
        const { error: updateError } = await supabaseAdmin
          .from('advances')
          .update({ status: 'failed', reason: 'DusuPay reported payout failed on reconciliation' })
          .eq('id', adv.id);

        if (updateError) {
          console.error('[reconcile-dusupay] Failed to mark processing_unknown -> failed', { advanceId: adv.id, updateError });
          unresolved3++;
          continue;
        }

        // Release reservation — safe because DusuPay confirmed failure
        if (!adv.employer_id || typeof adv.amount !== 'number') {
          console.error('[reconcile-dusupay] Missing employer_id or amount when releasing reservation for processing_unknown advance', { advanceId: adv.id, employer_id: adv.employer_id, amount: adv.amount });
        } else {
          const { error: releaseError } = await supabaseAdmin.rpc('release_employer_reservation', {
            p_employer_id: adv.employer_id,
            p_amount: adv.amount,
            p_advance_id: adv.id,
          });
          if (releaseError) {
            console.error('[reconcile-dusupay] release_employer_reservation failed for processing_unknown advance', { advanceId: adv.id, releaseError });
          }
        }

        resolved3++;
      } else {
        // Still processing — leave as-is
        unresolved3++;
      }

      if (DELAY_MS > 0) await sleep(DELAY_MS);
    }

    if (unresolved3 > 0) {
      void notifyAdmin({
        type: 'system_alert',
        title: `DusuPay reconciliation: ${unresolved3} processing_unknown advances still indeterminate`,
        message: `${unresolved3} advances remain in processing_unknown after status checks. They will be retried in the next run.`,
        metadata: { unresolved: unresolved3 },
      }).catch((err) => console.error('[reconcile-dusupay] notifyAdmin failed:', err));
    }

    log(`[reconcile-dusupay] processing_unknown: checked ${checked3}, resolved ${resolved3}, unresolved ${unresolved3}`);
    return { checked: checked3, resolved: resolved3, unresolved: unresolved3 };
  }

  const disbursedPendingResult = await processDisbursedPendingLedger(console.log);
  const processingUnknownResult = await processProcessingUnknown(console.log);

  const walletResult = await reconcileWalletTopups(console.log);
  const watchdogResult = await checkStuckProcessingAdvances(console.log);

  const totalChecked = checked + disbursedPendingResult.checked + processingUnknownResult.checked + walletResult.checked + watchdogResult.checked;
  const totalMismatches = mismatches + walletResult.mismatches;

  return NextResponse.json({
    checked: totalChecked,
    total: rows.length,
    mismatches: totalMismatches,
    stuckProcessing: watchdogResult.stuck,
    advances: { checked, total: rows.length, mismatches },
    walletTopups: walletResult,
    watchdog: watchdogResult,
    disbursed_pending_ledger: disbursedPendingResult,
    processing_unknown: processingUnknownResult,
  });
}

async function checkStuckProcessingAdvances(log: (msg: string) => void): Promise<{ checked: number; resolved: number; stuck: number }> {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: stuckRows, error } = await supabaseAdmin
    .from('advances')
    .select('id, reference, status, employer_id, amount')
    .eq('status', 'processing')
    .lt('updated_at', fifteenMinutesAgo)
    .limit(MAX_PER_RUN);

  if (error) {
    console.error('[reconcile-dusupay] Failed to fetch stuck processing advances:', error);
    return { checked: 0, resolved: 0, stuck: 0 };
  }

  const advances = (stuckRows ?? []) as AdvanceRow[];
  let checked = advances.length;
  let resolved = 0;
  const unresolvedStuck: string[] = [];

  for (const adv of advances) {
    if (adv.reference) {
      try {
        const result = await dusupay.checkPayoutStatus(adv.reference);
        const mapped = mapDusupayStatus(result.status);
        if (mapped === 'completed') {
          const { data: updated, error: updateError } = await supabaseAdmin
            .from('advances')
            .update({ status: 'completed', disbursed_at: new Date().toISOString() })
            .eq('id', adv.id);
          if (updateError) {
            console.error('[reconcile-dusupay] Failed to mark advance completed', { advanceId: adv.id, updateError });
            // keep this advance in the unresolved list so it will be alerted on and retried next run
            unresolvedStuck.push(adv.id);
            continue;
          }
          resolved++;
          continue;
        } else if (mapped === 'failed') {
          const { data: updated, error: updateError } = await supabaseAdmin
            .from('advances')
            .update({ status: 'failed', reason: 'DusuPay payout marked failed in reconciliation' })
            .eq('id', adv.id);
          if (updateError) {
            console.error('[reconcile-dusupay] Failed to mark advance failed', { advanceId: adv.id, updateError });
            // keep this advance in the unresolved list so it will be alerted on and retried next run
            unresolvedStuck.push(adv.id);
            continue;
          }

          // Attempt to release the employer reservation associated with this advance.
          // Uses the existing DB RPC used elsewhere in the codebase. This is money-adjacent;
          // errors are logged and cause the advance to remain in the unresolved list
          // so manual intervention or a retry can pick it up.
          if (!adv.employer_id || typeof adv.amount !== 'number') {
            console.error('[reconcile-dusupay] Missing employer_id or amount for advance when attempting reservation release', { advanceId: adv.id, employer_id: adv.employer_id, amount: adv.amount });
            unresolvedStuck.push(adv.id);
            continue;
          }

          const { error: releaseError } = await supabaseAdmin.rpc('release_employer_reservation', {
            p_employer_id: adv.employer_id,
            p_amount: adv.amount,
            p_advance_id: adv.id,
          });

          if (releaseError) {
            console.error('[reconcile-dusupay] release_employer_reservation RPC failed', { advanceId: adv.id, releaseError });
            // Keep this advance unresolved so it shows up in alerts and can be retried.
            unresolvedStuck.push(adv.id);
            continue;
          }

          resolved++;
          continue;
        }
      } catch (err) {
        console.error('[reconcile-dusupay] Error verifying stuck advance reference:', adv.id, err);
      }
    }
    unresolvedStuck.push(adv.id);
  }

  if (unresolvedStuck.length > 0) {
    void notifyAdmin({
      type: 'system_alert',
      title: `Watchdog Alert: ${unresolvedStuck.length} advance(s) stuck in processing`,
      message: `${unresolvedStuck.length} advance(s) have been sitting in status 'processing' for >15 minutes. Manual review required.`,
      metadata: { stuck_advance_ids: unresolvedStuck },
    }).catch((err) => console.error('[reconcile-dusupay] notifyAdmin failed:', err));
  }

  log(`[reconcile-dusupay] Watchdog: checked ${checked} stuck advances, resolved ${resolved}, ${unresolvedStuck.length} remaining stuck`);
  return { checked, resolved, stuck: unresolvedStuck.length };
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
