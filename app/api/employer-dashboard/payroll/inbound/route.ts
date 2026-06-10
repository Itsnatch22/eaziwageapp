// app/api/payroll/inbound/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';

// ─── Types ────────────────────────────────────────────────────────────────────

type SyncStatus = 'success' | 'failed' | 'partial';

interface InboundEmployee {
  employee_code: string;
  days_worked?: number;
  gross_salary: number;
  deductions?: number;
  net_salary?: number;
}

interface InboundPayload {
  month: string;                     // "YYYY-MM"
  employees: InboundEmployee[];
  provider_ref?: string;             // optional external reference
}

interface EmployeeOnboardingRow {
  id: string;
  employee_code: string | null;
  monthly_salary: number | null;
  status: string;
}

interface UploadRow {
  id: string;
}

interface IntegrationRow {
  id: string;
  employer_id: string;
  webhook_secret: string | null;
  status: string;
}

interface RowResult {
  upload_id: string;
  employer_id: string;
  employee_code: string;
  employee_id: string | null;
  days_worked: number | null;
  gross_salary: number;
  deductions: number;
  net_salary: number;
  row_status: 'valid' | 'invalid' | 'warning';
  row_errors: { field: string; message: string }[];
  row_warnings: { field: string; message: string }[];
  source_row: number;
}

// ─── HMAC verification ────────────────────────────────────────────────────────

function verifyHmacSignature(
  rawBody: string,
  secret: string,
  receivedSignature: string,
): boolean {
  const expected = createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  const expectedBuffer = Buffer.from(`sha256=${expected}`, 'utf8');
  const receivedBuffer = Buffer.from(receivedSignature, 'utf8');

  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

// ─── Month validation ─────────────────────────────────────────────────────────

function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const syncStart = Date.now();

  // 1. Extract integration code from Authorization header
  // Expected: "Authorization: Bearer <integration_code>"
  const authHeader = req.headers.get('authorization') ?? '';
  const integrationCode = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!integrationCode) {
    return NextResponse.json(
      { error: 'Missing or malformed Authorization header. Expected: Bearer <integration_code>' },
      { status: 401 },
    );
  }

  // 2. Read raw body (needed for HMAC verification before JSON parse)
  const rawBody = await req.text();

  // 3. Extract HMAC signature from header
  // Expected: "X-EWA-Signature: sha256=<hmac_hex>"
  const receivedSignature = req.headers.get('x-ewa-signature') ?? '';

  // 4. Bootstrap Supabase with service role (no user session on inbound webhooks)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[payroll/inbound] Missing Supabase env vars');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 5. Look up integration by code
  const { data: integration, error: intgErr } = await supabase
    .from('payroll_integrations')
    .select('id, employer_id, webhook_secret, status')
    .eq('integration_code', integrationCode)
    .maybeSingle();

  if (intgErr) {
    console.error('[payroll/inbound] integration lookup error', intgErr.message);
    return NextResponse.json({ error: 'Integration lookup failed' }, { status: 500 });
  }

  if (!integration) {
    // Intentionally vague — don't confirm code existence to an unknown caller
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const intg = integration as IntegrationRow;

  if (intg.status === 'disconnected') {
    return NextResponse.json(
      { error: 'This integration has been disconnected. Contact your EaziWage administrator.' },
      { status: 403 },
    );
  }

  // 6. Verify HMAC signature
  if (!intg.webhook_secret) {
    return NextResponse.json({ error: 'Integration has no webhook secret configured' }, { status: 403 });
  }

  if (!receivedSignature) {
    return NextResponse.json(
      { error: 'Missing X-EWA-Signature header' },
      { status: 401 },
    );
  }

  const signatureValid = verifyHmacSignature(rawBody, intg.webhook_secret, receivedSignature);
  if (!signatureValid) {
    console.warn('[payroll/inbound] HMAC verification failed for integration', intg.id);
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
  }

  // 7. Parse JSON body
  let payload: InboundPayload;
  try {
    payload = JSON.parse(rawBody) as InboundPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // 8. Basic payload validation
  if (!payload.month || !isValidMonth(payload.month)) {
    return NextResponse.json(
      { error: 'Invalid or missing "month" field. Expected format: YYYY-MM' },
      { status: 422 },
    );
  }

  if (!Array.isArray(payload.employees) || payload.employees.length === 0) {
    return NextResponse.json(
      { error: '"employees" must be a non-empty array' },
      { status: 422 },
    );
  }

  const { month, employees: rows } = payload;
  const employerId = intg.employer_id;

  // 9. Upsert payroll_upload record (source = 'api_push')
  const { data: uploadData, error: uploadErr } = await supabase
    .from('payroll_uploads')
    .upsert(
      {
        employer_id:   employerId,
        month,
        source:        'api_push',
        status:        'processing',
        total_rows:    rows.length,
        integration_id: intg.id,
        uploaded_at:   new Date().toISOString(),
      },
      { onConflict: 'employer_id,month,source' },
    )
    .select('id')
    .single();

  if (uploadErr || !uploadData) {
    console.error('[payroll/inbound] upload upsert error', uploadErr?.message);
    return NextResponse.json({ error: 'Failed to create upload record' }, { status: 500 });
  }

  const uploadId = (uploadData as UploadRow).id;

  // 10. Fetch known employees for this employer from employee_onboarding
  const { data: knownEmployees, error: empErr } = await supabase
    .from('employee_onboarding')
    .select('id, employee_code, monthly_salary, status')
    .eq('employer_id', employerId);

  if (empErr) {
    console.error('[payroll/inbound] employee fetch error', empErr.message);
    return NextResponse.json({ error: 'Failed to fetch employee records' }, { status: 500 });
  }

  const employeeMap = new Map<string, EmployeeOnboardingRow>(
    (knownEmployees ?? []).map((e) => [e.employee_code ?? '', e as EmployeeOnboardingRow]),
  );

  // 11. Validate and shape each row
  const rowResults: RowResult[] = [];
  let processedCount = 0;
  let failedCount = 0;
  const errorSummary: { row: number; field: string; message: string }[] = [];
  const warningSummary: { row: number; field: string; message: string }[] = [];

  const MAX_SALARY_MULTIPLIER = 3;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const errors: { field: string; message: string }[] = [];
    const warnings: { field: string; message: string }[] = [];

    if (!row.employee_code) {
      errors.push({ field: 'employee_code', message: 'employee_code is required' });
    }

    const known = row.employee_code ? employeeMap.get(row.employee_code) : undefined;

    if (row.employee_code && !known) {
      errors.push({
        field: 'employee_code',
        message: `Employee code '${row.employee_code}' not found in your workforce`,
      });
    } else if (known && known.status !== 'approved') {
      errors.push({
        field: 'employee_code',
        message: `Employee '${row.employee_code}' is not yet KYC-approved (status: ${known.status})`,
      });
    }

    if (row.gross_salary === undefined || row.gross_salary === null) {
      errors.push({ field: 'gross_salary', message: 'gross_salary is required' });
    } else if (row.gross_salary <= 0) {
      errors.push({ field: 'gross_salary', message: 'gross_salary must be greater than 0' });
    }

    const deductions = row.deductions ?? 0;

    if (deductions < 0) {
      errors.push({ field: 'deductions', message: 'deductions cannot be negative' });
    }

    if (row.gross_salary > 0 && deductions > row.gross_salary) {
      errors.push({ field: 'deductions', message: 'deductions cannot exceed gross_salary' });
    }

    if (row.days_worked !== undefined) {
      if (row.days_worked < 1) {
        errors.push({ field: 'days_worked', message: 'days_worked must be at least 1' });
      }
      if (row.days_worked > 31) {
        errors.push({ field: 'days_worked', message: 'days_worked cannot exceed 31' });
      }
    }

    if (known && row.gross_salary > (known.monthly_salary ?? 0) * MAX_SALARY_MULTIPLIER) {
      warnings.push({
        field: 'gross_salary',
        message: `gross_salary (${row.gross_salary}) is more than ${MAX_SALARY_MULTIPLIER}× the salary on file — please verify`,
      });
    }

    if (known && row.gross_salary > 0 && row.gross_salary < (known.monthly_salary ?? 0) * 0.5) {
      warnings.push({
        field: 'gross_salary',
        message: 'gross_salary is less than half the expected salary — possible data entry error',
      });
    }

    const rowStatus: 'valid' | 'invalid' | 'warning' =
      errors.length > 0 ? 'invalid' : warnings.length > 0 ? 'warning' : 'valid';

    if (rowStatus === 'invalid') {
      failedCount++;
      errors.forEach((e) => errorSummary.push({ row: rowNum, ...e }));
    } else {
      processedCount++;
      warnings.forEach((w) => warningSummary.push({ row: rowNum, ...w }));
    }

    const net = Math.max(0, (row.gross_salary ?? 0) - deductions);

    rowResults.push({
      upload_id:     uploadId,
      employer_id:   employerId,
      employee_code: row.employee_code ?? '',
      employee_id:   known?.id ?? null,
      days_worked:   row.days_worked ?? null,
      gross_salary:  row.gross_salary ?? 0,
      deductions,
      net_salary:    net,
      row_status:    rowStatus,
      row_errors:    errors,
      row_warnings:  warnings,
      source_row:    rowNum,
    });
  }

  // 12. Insert row results (delete existing first to allow re-push idempotency)
  await supabase.from('payroll_upload_rows').delete().eq('upload_id', uploadId);

  if (rowResults.length > 0) {
    const { error: rowsErr } = await supabase
      .from('payroll_upload_rows')
      .insert(rowResults);

    if (rowsErr) {
      console.error('[payroll/inbound] insert rows error', rowsErr.message);
    }
  }

  // 13. Compute totals from valid rows only
  const validRows = rowResults.filter((r) => r.row_status !== 'invalid');
  const totalGross = validRows.reduce((s, r) => s + r.gross_salary, 0);
  const totalNet   = validRows.reduce((s, r) => s + r.net_salary, 0);
  const totalDed   = validRows.reduce((s, r) => s + r.deductions, 0);

  const finalStatus: 'processed' | 'failed' | 'partial' =
    failedCount === rows.length ? 'failed' : failedCount > 0 ? 'partial' : 'processed';

  // 14. Update payroll_uploads record
  await supabase
    .from('payroll_uploads')
    .update({
      status:           finalStatus,
      processed_rows:   processedCount,
      failed_rows:      failedCount,
      total_gross:      totalGross,
      total_net:        totalNet,
      total_deductions: totalDed,
      error_summary:    errorSummary,
      warning_summary:  warningSummary,
      processed_at:     new Date().toISOString(),
    })
    .eq('id', uploadId);

  const durationMs = Date.now() - syncStart;
  const syncStatus: SyncStatus =
    finalStatus === 'processed' ? 'success' : finalStatus === 'partial' ? 'partial' : 'failed';

  const { error: logErr } = await supabase
    .from('payroll_sync_logs')
    .insert({
      integration_id:   intg.id,
      employer_id:      employerId,
      triggered_by:     'webhook',
      status:           syncStatus,
      records_received: rows.length,
      records_valid:    processedCount,
      records_failed:   failedCount,
      upload_id:        uploadId,
      error_message:    failedCount > 0 ? `${failedCount} row(s) failed validation` : null,
      duration_ms:      durationMs,
    });

  if (logErr) {
    console.error('[payroll/inbound] sync log insert error', logErr.message);
  }

  await supabase
    .from('payroll_integrations')
    .update({
      last_sync_at:     new Date().toISOString(),
      last_sync_status: syncStatus,
      last_error:       failedCount > 0 ? `${failedCount} row(s) failed validation` : null,
      status:           syncStatus === 'failed' ? 'error' : 'active',
    })
    .eq('id', intg.id);

  // 17. Respond
  return NextResponse.json(
    {
      message:          finalStatus === 'processed' ? 'Payroll data received and processed.' : `Payroll data received with ${failedCount} failed row(s).`,
      upload_id:        uploadId,
      status:           finalStatus,
      month,
      total_rows:       rows.length,
      processed_rows:   processedCount,
      failed_rows:      failedCount,
      duration_ms:      durationMs,
      ...(errorSummary.length > 0 && { error_summary: errorSummary }),
      ...(warningSummary.length > 0 && { warning_summary: warningSummary }),
      totals: {
        gross:      totalGross,
        net:        totalNet,
        deductions: totalDed,
      },
    },
    { status: 200 },
  );
}