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

    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, onboarding_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (employerError) {
      console.error('[payroll/history] employer lookup error', employerError.message);
      return NextResponse.json({ error: 'Failed to resolve employer' }, { status: 500 });
    }

    if (!employer) {
      return NextResponse.json([], { status: 200 });
    }

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
      .eq('employer_id', employer.onboarding_id)
      .order('month', { ascending: false })
      .limit(24); // 2 years of monthly uploads

    if (error) {
      console.error('[payroll/history] fetch uploads error', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(uploads ?? []);
  } catch (err: unknown) {
    console.error('[payroll/history] unexpected error', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
