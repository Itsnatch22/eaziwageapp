import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (employerError) {
      return NextResponse.json({ error: 'Failed to resolve employer' }, { status: 500 });
    }
    if (!employer) {
      return NextResponse.json({ error: 'Employer not found' }, { status: 403 });
    }

    // Fetch pending and overdue schedules with employee names
    const { data: schedules, error: scheduleError } = await supabaseAdmin
      .from('repayment_schedules')
      .select(`
        id, advance_id, repayment_amount, currency, due_date,
        status, paid_amount, repayment_reference,
        employees!repayment_schedules_employee_id_fkey(full_name)
      `)
      .eq('employer_id', employer.id)
      .in('status', ['pending', 'overdue', 'partial'])
      .order('due_date', { ascending: true });

    if (scheduleError) {
      console.error('[repayment-schedules] fetch error:', scheduleError);
      return NextResponse.json({ error: 'Failed to fetch repayment schedules' }, { status: 500 });
    }

    // Read Stanbic bank details from global_settings.platform_settings
    const { data: settings } = await supabaseAdmin
      .from('global_settings')
      .select('platform_settings')
      .eq('id', 'default')
      .maybeSingle();

    const ps = (settings?.platform_settings ?? {}) as Record<string, unknown>;
    const bankDetails = {
      bank_name: (ps.repayment_bank_name as string | null) ?? null,
      bank_account: (ps.repayment_bank_account as string | null) ?? null,
    };

    const formatted = (schedules ?? []).map((s) => {
      const empRaw = s.employees as unknown;
      const employeeName =
        Array.isArray(empRaw)
          ? (empRaw[0] as { full_name?: string | null })?.full_name ?? 'Unknown'
          : (empRaw as { full_name?: string | null } | null)?.full_name ?? 'Unknown';

      return {
        id: s.id,
        advance_id: s.advance_id,
        employee_name: employeeName,
        repayment_amount: Number(s.repayment_amount),
        currency: s.currency ?? 'KES',
        due_date: s.due_date,
        status: s.status,
        paid_amount: Number(s.paid_amount ?? 0),
        repayment_reference: s.repayment_reference,
      };
    });

    return NextResponse.json({ schedules: formatted, bank_details: bankDetails });
  } catch (err: unknown) {
    console.error('[repayment-schedules] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
