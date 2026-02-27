// app/api/payroll/history/route.ts
//
// GET /api/payroll/history
//
// Returns all payroll_uploads for the authenticated employer,
// newest first. Includes per-upload summary stats and error/warning counts.
//
// Response shape:
// [
//   {
//     id, month, source, status,
//     file_name, total_rows, processed_rows, failed_rows,
//     total_gross, total_net, total_deductions,
//     error_summary: [{row, field, message}],
//     warning_summary: [{row, field, message}],
//     uploaded_at, processed_at,
//     employees: [ { employee_code, days_worked, gross_salary, row_status, row_errors } ]
//   }
// ]
//
import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve employer
    const { data: employer, error: employerError } = await supabase
      .from('employer_onboarding')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (employerError) {
      console.error('[payroll/history] employer lookup error', employerError.message);
      return NextResponse.json({ error: 'Failed to resolve employer' }, { status: 500 });
    }

    if (!employer) {
      return NextResponse.json([], { status: 200 }); // empty set for new employers
    }

    // Fetch uploads with their row summaries
    const { data: uploads, error } = await supabase
      .from('payroll_uploads')
      .select(`
        id, month, source, status,
        file_name, file_size_bytes,
        total_rows, processed_rows, failed_rows,
        total_gross, total_net, total_deductions,
        error_summary, warning_summary,
        integration_id,
        uploaded_at, processed_at, created_at,
        employees:payroll_upload_rows (
          employee_code, days_worked, gross_salary, deductions, net_salary,
          row_status, row_errors, row_warnings, source_row
        )
      `)
      .eq('employer_id', employer.id)
      .order('month', { ascending: false })
      .limit(24); // 2 years of monthly uploads

    if (error) {
      console.error('[payroll/history] fetch uploads error', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(uploads ?? []);
  } catch (err: any) {
    console.error('[payroll/history] unexpected error', err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}