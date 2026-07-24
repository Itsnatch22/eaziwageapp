ClamAV integration for payment-method document scanning

Goal

Provide production-grade malware scanning for uploaded bank statements and payment-method documents using ClamAV (clamd). The scanner must run as a reliable service (sidecar or dedicated) and the app must update payment_methods.verification_metadata.scan_status and write verification audit rows.

High-level architecture

- Storage: documents are uploaded to private Supabase Storage bucket (employee-kyc-documents).
- Scanner: a ClamAV daemon (clamd) runs as a service reachable from the app or a dedicated scanner worker.
  - Option A: Sidecar/daemon on same VPC (recommended for production)
  - Option B: Dedicated scanning service (container) behind internal network
- Worker: the existing internal cron endpoint (/api/internal/scan-payment-method-docs) invokes a scan worker that:
  1. Lists queued payment_methods with verification_metadata.scan_status='queued'
  2. Downloads object from storage (streaming)
  3. Streams file to clamd for scan
  4. Updates payment_methods.verification_metadata with scan_status and scanned_at
  5. Inserts payment_method_verification_audit row with scan result
  6. Emits metrics/logs

Security considerations

- Never expose clamd to the public internet. Limit access by VPC or firewall rules.
- Do not log PII. Store only checksum, scan_status, and non-identifying metadata in verification_metadata and audits.
- Ensure scanned files are stored in a private bucket and signed URLs are short-lived (<1h).
- Use RBAC/service keys for the scanning worker (server-side only).

ClamAV deployment options

1) Docker Compose (local / small staging)

version: '3.7'
services:
  clamav:
    image: clamav/clamav:latest
    restart: unless-stopped
    volumes:
      - clamav-db:/var/lib/clamav
    ports:
      - "3310:3310" # clamd
    healthcheck:
      test: ["CMD", "clamdscan", "--version"]
      interval: 1m
      timeout: 30s

volumes:
  clamav-db:

Notes: keep freshclam running (the image may auto-run freshclam). For production use a hardened image.

2) Kubernetes / Cloud Run

- Run clamd as a Deployment/StatefulSet with a persistent volume for signatures.
- Expose clamd internally via a ClusterIP service.
- Run the scan worker as a CronJob or Deployment that polls the internal API and calls clamd.
- Ensure liveness/readiness probes and automatic freshclam updates.

Integration details (Node.js example)

Use a streaming approach to avoid loading large files fully into memory. Example pseudo-code:

1. Download the file from Supabase storage as a stream.
2. Connect to clamd (TCP socket or Unix socket).
3. Send the stream over the protocol (e.g., INSTREAM mode).
4. Parse clamd response: 'OK', 'FOUND <virus>', 'ERROR'.
5. Update DB accordingly.

Example using spawn and clamdscan (shell) for simplicity:

const { spawn } = require('child_process');

async function scanWithClamAVStream(stream) {
  return new Promise((resolve, reject) => {
    const clamscan = spawn('clamdscan', ['-'], { stdio: ['pipe', 'pipe', 'inherit'] });
    stream.pipe(clamscan.stdin);
    let out = '';
    clamscan.stdout.on('data', (d) => out += d.toString());
    clamscan.on('close', (code) => {
      // parse out for FOUND/OK
      resolve(out.trim());
    });
    clamscan.on('error', reject);
  });
}

Better: use a clamd client (e.g. clamdjs) to use INSTREAM which avoids spawning processes.

Handling large files

- Stream to clamd (INSTREAM). Do not buffer whole file in memory.
- Use timeouts and retry/backoff when clamd is busy.
- Protect clamd by limiting concurrent scans.

Signature updates

- Use freshclam or scheduled signature updates. Keep signatures current (daily or more frequently).
- Monitor freshclam logs and set alerts for failed updates.

Metrics and monitoring

- Export scan counts, failures, average latency to Prometheus or similar.
- Alert on elevated 'flagged' rates or failed downloads/scans.

Failure modes & design choices

- If scan fails (download, clamd error), set verification_metadata.scan_status = 'scan_failed' or 'download_failed' and leave verification_status as 'pending_review' for manual triage.
- If checksum mismatches, set scan_status='flagged' and surface prominently in the admin UI.
- On 'FOUND' (virus), set scan_status='infected' and mark payment_method.verification_status='rejected' and notify compliance. Do NOT automatically delete files — retain for forensics but restrict access.

Updating the scan worker (what to change in code)

- Replace evaluateScanResult in lib/scanService.ts with a call to clamd via a small adapter (lib/clamavAdapter.ts) which exposes scanBuffer/scanStream.
- Ensure scanQueuedPaymentMethodDocuments streams the file to the adapter, uses the adapter response to set verification_metadata.scan_status, and inserts a verification audit row (action: scan_clean / scan_flagged / scan_infected / scan_failed).

Checklist before production rollout

- Deploy ClamAV to a hardened environment (internal network) with PV for signatures.
- Add health checks and signature-update monitoring.
- Create GitHub Secrets: CRON_SECRET and SCAN_ENDPOINT (pointing to https://app.eaziwage.com/api/internal/scan-payment-method-docs).
- Deploy DB migration and run smoke tests: upload sample PDF, run cron manually, assert DB updated and audit row present.
- Add observability: logs, metrics, and alerting for scan failures.

Support

If needed, provide a sample clamd adapter implementation and a deployment manifest for your environment. Keep scanning isolated and audited.