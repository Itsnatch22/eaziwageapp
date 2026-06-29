import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { triggerSyncSchema } from '@/lib/validations/payroll-validation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

type UploadSyncStatus = 'success' | 'failed' | 'partial';
type SyncStatus = UploadSyncStatus | 'no_data';

interface EmployerRow {
  id: string;
  onboarding_id: string | null;
}

interface IntegrationRow {
  id: string;
  provider: string;
  status: string;
  sync_mode: string;
  sync_frequency: string;
  sync_time: string | null;
}

interface UploadRow {
  id: string;
  status: string;
  month: string;
  total_rows: number;
  processed_rows: number;
  failed_rows: number;
  total_gross: number;
  total_net: number;
  total_deductions: number;
  error_summary: { row: number; field: string; message: string }[];
  warning_summary: { row: number; field: string; message: string }[];
  uploaded_at: string;
  processed_at: string | null;
}

interface UploadRowRecord {
  employee_code: string;
  days_worked: number | null;
  gross_salary: number;
  deductions: number;
  net_salary: number;
  row_status: string;
  row_errors: { field: string; message: string }[];
  row_warnings: { field: string; message: string }[];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const syncStart = Date.now();
  const supabase = await createClient();


  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }


  const { data: employer, error: employerError } = await supabase
    .from('employers')
    .select('id, onboarding_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (employerError) {
    console.error('[payroll/sync] employer lookup error', employerError.message);
    return NextResponse.json({ error: 'Failed to resolve employer' }, { status: 500 });
  }

  if (!employer) {
    return NextResponse.json({ error: 'Payroll sync is available once your account is approved.' }, { status: 403 });
  }

  const { onboarding_id } = employer as EmployerRow;

  if (!onboarding_id) {
    return NextResponse.json({ error: 'Employer onboarding record not linked.' }, { status: 403 });
  }


  const raw = await req.json().catch(() => null);
  if (!raw) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = triggerSyncSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        detail: parsed.error.issues.map((e) => ({ field: e.path.join('.'), msg: e.message })),
      },
      { status: 422 },
    );
  }

  const { integration_id } = parsed.data;


const { data: integration, error: intgErr } = await supabase
     .from('payroll_integrations')
     .select('id, provider, status, sync_mode, sync_frequency, sync_time')
     .eq('id', integration_id)
     .eq('employer_live_id', employer.id)
     .maybeSingle();

  if (intgErr) {
    console.error('[payroll/sync] integration lookup error', intgErr.message);
    return NextResponse.json({ error: intgErr.message }, { status: 500 });
  }

  if (!integration) {
    return NextResponse.json(
      { error: 'Integration not found or does not belong to your organisation.' },
      { status: 404 },
    );
  }

  const intg = integration as IntegrationRow;

const { data: latestUpload, error: uploadErr } = await supabase
     .from('payroll_uploads')
     .select(`
       id, status, month,
       total_rows, processed_rows, failed_rows,
       total_gross, total_net, total_deductions,
       error_summary, warning_summary,
       uploaded_at, processed_at
     `)
     .eq('employer_live_id', employer.id)
     .eq('source', 'api_push')
     .eq('integration_id', integration_id)
     .order('uploaded_at', { ascending: false })
     .limit(1)
     .maybeSingle();

  if (uploadErr) {
    console.error('[payroll/sync] upload fetch error', uploadErr.message);
    return NextResponse.json({ error: 'Failed to fetch payroll data' }, { status: 500 });
  }

  if (!latestUpload) {
    const now = new Date().toISOString();
    const durationMs = Date.now() - syncStart;

    await supabase
      .from('payroll_integrations')
      .update({
        last_sync_at:     now,
        last_sync_status: 'failed',
        last_error:       'No payroll data has been pushed by the provider yet.',
        status:           'pending',
      })
      .eq('id', integration_id);

await supabase
       .from('payroll_sync_logs')
       .insert({
         integration_id,
         employer_id:      onboarding_id,
         employer_live_id: employer.id,
         triggered_by:     'manual',
         status:           'failed',
         records_received: 0,
         records_valid:    0,
         records_failed:   0,
         error_message:    'No payroll data has been pushed by the provider yet.',
         duration_ms:      durationMs,
       });

    return NextResponse.json(
      {
        message:  'No payroll data has been received from the provider yet. Ask your IT administrator to push data first.',
        status:   'no_data' as SyncStatus,
        provider: intg.provider,
        last_sync_at: now,
      },
      { status: 200 },
    );
  }

  const upload = latestUpload as UploadRow;


  const { data: employeeRows, error: rowsErr } = await supabase
    .from('payroll_upload_rows')
    .select(`
      employee_code, days_worked,
      gross_salary, deductions, net_salary,
      row_status, row_errors, row_warnings
    `)
    .eq('upload_id', upload.id)
    .order('source_row', { ascending: true });

  if (rowsErr) {
    console.error('[payroll/sync] rows fetch error', rowsErr.message);
  }

  const rows = (employeeRows ?? []) as UploadRowRecord[];


  const syncStatus: UploadSyncStatus =
    upload.status === 'processed' ? 'success' :
    upload.status === 'partial'   ? 'partial'  :
    upload.status === 'failed'    ? 'failed'   : 'success';

  const durationMs = Date.now() - syncStart;
  const now = new Date().toISOString();


const { data: syncLog, error: logErr } = await supabase
     .from('payroll_sync_logs')
     .insert({
       integration_id,
       employer_id:      onboarding_id,
       employer_live_id: employer.id,
       triggered_by:     'manual',
       status:           syncStatus,
       records_received: upload.total_rows,
       records_valid:    upload.processed_rows,
       records_failed:   upload.failed_rows,
       upload_id:        upload.id,
       error_message:    upload.failed_rows > 0
         ? `${upload.failed_rows} row(s) failed validation`
         : null,
       duration_ms:      durationMs,
     })
     .select('id')
     .single();

  if (logErr) {
    console.error('[payroll/sync] log insert error', logErr.message);
  }


  await supabase
    .from('payroll_integrations')
    .update({
      last_sync_at:     now,
      last_sync_status: syncStatus,
      last_error:       upload.failed_rows > 0
        ? `${upload.failed_rows} row(s) failed validation`
        : null,
      status: syncStatus === 'failed' ? 'error' : 'active',
    })
    .eq('id', integration_id);

  // Propagate gross salary to employee records for valid rows
  const validRows = rows.filter((r) => r.row_status === 'valid' && r.gross_salary > 0);
  for (const row of validRows) {
    const salaryPatch = { monthly_salary: row.gross_salary, updated_at: now };

    const [empResult, onbResult] = await Promise.all([
      supabaseAdmin
        .from('employees')
        .update(salaryPatch)
        .eq('employee_code', row.employee_code)
        .eq('employer_id', employer.id),
      supabaseAdmin
        .from('employee_onboarding')
        .update(salaryPatch)
        .eq('employee_code', row.employee_code)
        .eq('employer_id', onboarding_id),
    ]);

    if (empResult.error) {
      console.error('[payroll/sync] salary update employees error', row.employee_code, empResult.error.message);
    }
    if (onbResult.error) {
      console.error('[payroll/sync] salary update employee_onboarding error', row.employee_code, onbResult.error.message);
    }
  }

  return NextResponse.json({
    message:          syncStatus === 'success'
      ? `Sync complete — ${upload.processed_rows} records loaded.`
      : syncStatus === 'partial'
      ? `Sync complete with issues — ${upload.failed_rows} record(s) failed.`
      : `Last push from provider had errors — ${upload.failed_rows} record(s) failed.`,
    sync_log_id:      syncLog?.id ?? null,
    status:           syncStatus,
    last_sync_at:     now,
    month:            upload.month,
    provider:         intg.provider,
    records_received: upload.total_rows,
    records_valid:    upload.processed_rows,
    records_failed:   upload.failed_rows,
    duration_ms:      durationMs,
    totals: {
      gross:      upload.total_gross,
      net:        upload.total_net,
      deductions: upload.total_deductions,
    },
    employees:        rows,
    ...(upload.error_summary?.length > 0   && { error_summary:   upload.error_summary }),
    ...(upload.warning_summary?.length > 0 && { warning_summary: upload.warning_summary }),
  });
}