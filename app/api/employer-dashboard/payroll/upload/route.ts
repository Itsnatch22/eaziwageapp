// app/api/employer-dashboard/payroll/upload/route.ts
import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { uploadPayrollSchema } from '@/lib/validations/payroll-validation';

export const runtime = 'nodejs';

const MAX_SALARY_MULTIPLIER = 3;
const MIN_DAYS_WORKED = 1;
const MAX_DAYS_WORKED = 31;

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: employer } = await supabase
    .from('employers')
    .select('id, onboarding_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!employer) {
    return NextResponse.json({ error: 'Employer profile not found.' }, { status: 403 });
  }

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const parsed = uploadPayrollSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', detail: parsed.error.issues.map(e => ({ field: e.path.join('.'), msg: e.message })) },
      { status: 422 },
    );
  }

  const { month, employees: rows, file_name, file_size_bytes } = parsed.data;

const { data: upload, error: uploadErr } = await supabase
     .from('payroll_uploads')
     .upsert(
       {
         employer_id:    employer.id,
         month,
         source:         'manual',
         status:         'processing',
         file_name:      file_name ?? null,
         file_size_bytes: file_size_bytes ?? null,
         total_rows:     rows.length,
         uploaded_by:    user.id,
         uploaded_at:    new Date().toISOString(),
       },
       { onConflict: 'employer_id,month,source' },
     )
     .select('id')
     .single();

  if (uploadErr || !upload) {
    console.error('[payroll/upload] upsert upload:', uploadErr?.message);
    return NextResponse.json({ error: uploadErr?.message ?? 'Failed to create upload record' }, { status: 500 });
  }

  const uploadId = upload.id;

const { data: knownEmployees } = await supabase
     .from('employee_onboarding')
     .select('id, employee_code, monthly_salary, status')
     .eq('employer_id', employer.id);

  const employeeMap = new Map(
    (knownEmployees ?? []).map(e => [e.employee_code, e])
  );

  type RowResult = {
    upload_id:      string;
    employer_id:    string;
    employee_code:  string;
    employee_id:    string | null;
    days_worked:    number | null;
    gross_salary:   number;
    deductions:     number;
    net_salary:     number;
    row_status:     'valid' | 'invalid' | 'warning';
    row_errors:     { field: string; message: string }[];
    row_warnings:   { field: string; message: string }[];
    source_row:     number;
  };

  const rowResults: RowResult[] = [];
  let processedCount = 0;
  let failedCount = 0;

  const errorSummary: { row: number; field: string; message: string }[] = [];
  const warningSummary: { row: number; field: string; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const errors: { field: string; message: string }[] = [];
    const warnings: { field: string; message: string }[] = [];

    const known = employeeMap.get(row.employee_code);

    if (!known) {
      errors.push({ field: 'employee_code', message: `Employee code '${row.employee_code}' not found in your workforce` });
    } else if (known.status !== 'approved') {
      errors.push({ field: 'employee_code', message: `Employee '${row.employee_code}' is not yet KYC-approved` });
    }

    if (row.days_worked !== undefined) {
      if (row.days_worked < MIN_DAYS_WORKED) {
        errors.push({ field: 'days_worked', message: `days_worked must be ≥ ${MIN_DAYS_WORKED}` });
      }
      if (row.days_worked > MAX_DAYS_WORKED) {
        errors.push({ field: 'days_worked', message: `days_worked cannot exceed ${MAX_DAYS_WORKED}` });
      }
    }

    if (row.gross_salary <= 0) {
      errors.push({ field: 'gross_salary', message: 'gross_salary must be greater than 0' });
    }

    if (row.deductions < 0) {
      errors.push({ field: 'deductions', message: 'deductions cannot be negative' });
    }

    if (row.deductions > row.gross_salary) {
      errors.push({ field: 'deductions', message: 'deductions cannot exceed gross_salary' });
    }

    if (known && row.gross_salary > (known.monthly_salary ?? 0) * MAX_SALARY_MULTIPLIER) {
      warnings.push({
        field: 'gross_salary',
        message: `gross_salary (${row.gross_salary}) is ${MAX_SALARY_MULTIPLIER}× higher than the expected salary on file — please verify`,
      });
    }

    if (known && row.gross_salary < (known.monthly_salary ?? 0) * 0.5) {
      warnings.push({
        field: 'gross_salary',
        message: `gross_salary is less than half the expected salary — possible data entry error`,
      });
    }

    const rowStatus: 'valid' | 'invalid' | 'warning' =
      errors.length > 0 ? 'invalid' : warnings.length > 0 ? 'warning' : 'valid';

    if (rowStatus === 'invalid') {
      failedCount++;
      errors.forEach(e => errorSummary.push({ row: rowNum, ...e }));
    } else {
      processedCount++;
      warnings.forEach(w => warningSummary.push({ row: rowNum, ...w }));
    }

    const net = Math.max(0, row.gross_salary - row.deductions);

rowResults.push({
       upload_id:     uploadId,
       employer_id:   employer.id,
       employee_code: row.employee_code,
       employee_id:   known?.id ?? null,
       days_worked:   row.days_worked ?? null,
       gross_salary:  row.gross_salary,
       deductions:    row.deductions,
       net_salary:    net,
       row_status:    rowStatus,
       row_errors:    errors,
       row_warnings:  warnings,
       source_row:    rowNum,
     });
  }

  await supabase.from('payroll_upload_rows').delete().eq('upload_id', uploadId);

  if (rowResults.length > 0) {
    const { error: rowsErr } = await supabase
      .from('payroll_upload_rows')
      .insert(rowResults);

    if (rowsErr) {
      console.error('[payroll/upload] insert rows:', rowsErr.message);
    }
  }

  const validRows = rowResults.filter(r => r.row_status !== 'invalid');
  const totalGross = validRows.reduce((s, r) => s + r.gross_salary, 0);
  const totalNet   = validRows.reduce((s, r) => s + r.net_salary, 0);
  const totalDed   = validRows.reduce((s, r) => s + r.deductions, 0);

  const finalStatus = failedCount === rows.length
    ? 'failed'
    : failedCount > 0
    ? 'partial'
    : 'processed';

  await supabase
    .from('payroll_uploads')
    .update({
      status:          finalStatus,
      processed_rows:  processedCount,
      failed_rows:     failedCount,
      total_gross:     totalGross,
      total_net:       totalNet,
      total_deductions: totalDed,
      error_summary:   errorSummary,
      warning_summary: warningSummary,
      processed_at:    new Date().toISOString(),
    })
    .eq('id', uploadId);

  return NextResponse.json(
    {
      upload_id:       uploadId,
      status:          finalStatus,
      total_rows:      rows.length,
      processed_rows:  processedCount,
      failed_rows:     failedCount,
      error_summary:   errorSummary,
      warning_summary: warningSummary,
      totals: {
        gross:      totalGross,
        net:        totalNet,
        deductions: totalDed,
      },
    },
    { status: 201 },
  );
}
