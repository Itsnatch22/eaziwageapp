import type { SupabaseClient } from '@supabase/supabase-js';
import { computeChecksum, isUnderMaxSize } from './fileUtils';

const BUCKET = 'employee-kyc-documents';

export function evaluateScanResult(buffer: Buffer, expectedChecksum?: string | null) {
  const computed = computeChecksum(buffer);
  const sizeOk = isUnderMaxSize(buffer);
  if (expectedChecksum && expectedChecksum !== computed) {
    return { status: 'flagged', reason: 'checksum_mismatch', computed, expected: expectedChecksum } as const;
  }
  if (!sizeOk) {
    return { status: 'flagged', reason: 'oversize', computed } as const;
  }
  // For now: files that pass checksum (if provided) and are under max size are "clean"
  return { status: 'clean', reason: 'ok', computed } as const;
}

export async function scanQueuedPaymentMethodDocuments(adminSupabase: SupabaseClient) {
  // Find queued payment methods
  const { data: rows, error } = await adminSupabase
    .from('payment_methods')
    .select('id, verification_document_path, verification_metadata, verification_document_hash')
    .eq('method_type', 'bank_account')
    .eq("verification_metadata->>scan_status", 'queued')
    .limit(50);

  if (error) throw error;
  if (!rows || rows.length === 0) return { processed: 0 };

  let processed = 0;
  for (const r of rows) {
    const path = r.verification_document_path;
    if (!path) continue;
    try {
      const { data: downloadData, error: dlErr } = await adminSupabase.storage.from(BUCKET).download(path);
      if (dlErr || !downloadData) {
        // mark queued -> flagged (couldn't download)
        await adminSupabase.from('payment_methods').update({ verification_metadata: { ...(r.verification_metadata ?? {}), scan_status: 'download_failed' }, updated_at: new Date().toISOString() }).eq('id', r.id);
        continue;
      }
      const buffer = Buffer.from(await downloadData.arrayBuffer());
      const scan = evaluateScanResult(buffer, r.verification_document_hash ?? (r.verification_metadata?.checksum ?? null));
      const newMeta = { ...(r.verification_metadata ?? {}), scan_status: scan.status, scanned_at: new Date().toISOString() } as Record<string, unknown>;

      await adminSupabase.from('payment_methods').update({ verification_metadata: newMeta }).eq('id', r.id);

      // write verification audit
      await adminSupabase.from('payment_method_verification_audit').insert({
        payment_method_id: r.id,
        admin_id: null,
        action: scan.status === 'clean' ? 'scan_clean' : 'scan_flagged',
        notes: scan.reason,
        checksum: scan.computed,
        document_path: path,
      });

      processed += 1;
    } catch (err) {
      console.error('[scanService] failed scan for', r.id, err);
    }
  }

  return { processed };
}
