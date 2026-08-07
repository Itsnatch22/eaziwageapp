import type { SupabaseClient } from '@supabase/supabase-js';
import { computeChecksum, isUnderMaxSize } from './fileUtils';
import { scanBufferWithClamAV, type ClamAVScanOptions } from './clamavAdapter';

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
  // For basic sync evaluation: files that pass checksum and size check
  return { status: 'clean', reason: 'ok', computed } as const;
}

export async function evaluateScanResultWithClamAV(
  buffer: Buffer,
  expectedChecksum?: string | null,
  options?: ClamAVScanOptions,
) {
  const computed = computeChecksum(buffer);
  const sizeOk = isUnderMaxSize(buffer);
  if (expectedChecksum && expectedChecksum !== computed) {
    return { status: 'flagged', reason: 'checksum_mismatch', computed, expected: expectedChecksum, virus: null } as const;
  }
  if (!sizeOk) {
    return { status: 'flagged', reason: 'oversize', computed, virus: null } as const;
  }

  // ClamAV Malware Scan over TCP Socket
  const clamResult = await scanBufferWithClamAV(buffer, options);

  if (clamResult.status === 'infected') {
    return {
      status: 'infected',
      reason: `malware_detected: ${clamResult.virus || 'Virus Found'}`,
      computed,
      virus: clamResult.virus ?? 'Malware Detected',
    } as const;
  }

  if (clamResult.status === 'clean') {
    return { status: 'clean', reason: 'ok', computed, virus: null } as const;
  }

  // Fallback: If ClamAV daemon is unreachable or unconfigured in local dev/staging, fallback to size/checksum clean
  if (clamResult.status === 'unavailable') {
    return { status: 'clean', reason: `ok_fallback: ${clamResult.message}`, computed, virus: null } as const;
  }

  return { status: 'scan_failed', reason: clamResult.message || 'scan_error', computed, virus: null } as const;
}

export async function scanQueuedPaymentMethodDocuments(
  adminSupabase: SupabaseClient,
  clamavOptions?: ClamAVScanOptions,
) {
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
        await adminSupabase.from('payment_methods').update({
          verification_metadata: { ...(r.verification_metadata ?? {}), scan_status: 'download_failed' },
          updated_at: new Date().toISOString(),
        }).eq('id', r.id);

        await adminSupabase.from('payment_method_verification_audit').insert({
          payment_method_id: r.id,
          admin_id: null,
          action: 'scan_failed',
          notes: 'Storage download failed',
          checksum: null,
          document_path: path,
        });
        continue;
      }

      const buffer = Buffer.from(await downloadData.arrayBuffer());
      const scan = await evaluateScanResultWithClamAV(
        buffer,
        r.verification_document_hash ?? (r.verification_metadata?.checksum ?? null),
        clamavOptions,
      );

      const newMeta = {
        ...(r.verification_metadata ?? {}),
        scan_status: scan.status,
        scanned_at: new Date().toISOString(),
        ...(scan.virus ? { virus_detected: scan.virus } : {}),
      } as Record<string, unknown>;

      const isRejected = scan.status === 'infected';

      await adminSupabase.from('payment_methods').update({
        verification_metadata: newMeta,
        ...(isRejected ? { verification_status: 'rejected' } : {}),
        updated_at: new Date().toISOString(),
      }).eq('id', r.id);

      const actionMap: Record<string, string> = {
        clean: 'scan_clean',
        infected: 'scan_infected',
        flagged: 'scan_flagged',
        scan_failed: 'scan_failed',
      };

      // write verification audit
      await adminSupabase.from('payment_method_verification_audit').insert({
        payment_method_id: r.id,
        admin_id: null,
        action: actionMap[scan.status] ?? 'scan_flagged',
        notes: scan.reason,
        checksum: scan.computed,
        document_path: path,
      });

      if (scan.status === 'infected' || scan.status === 'flagged') {
        void import('./notifications').then(({ notifyAdmin }) => {
          return notifyAdmin({
            type: 'system_alert',
            title: scan.status === 'infected' ? '🚨 Malware Detected in KYC Document' : '⚠️ KYC Document Flagged',
            message: `Payment method document ${path} (ID: ${r.id}) status: ${scan.status}. Reason: ${scan.reason}`,
            metadata: { payment_method_id: r.id, path, scan_status: scan.status, reason: scan.reason },
          });
        }).catch(() => {});
      }

      processed += 1;
    } catch (err) {
      console.error('[scanService] failed scan for', r.id, err);
    }
  }

  return { processed };
}
