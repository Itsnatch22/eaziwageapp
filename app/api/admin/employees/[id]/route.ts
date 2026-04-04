import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { checkAdminAccess } from '@/lib/server/admin-auth';

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface EmployeeAdvanceRow {
  id: string;
  amount: number | string | null;
  fee_amount?: number | string | null;
  status: string | null;
  created_at: string | null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminAccess = await checkAdminAccess({ user, adminSupabase });
    if (adminAccess.error) {
      return NextResponse.json({ error: 'Failed to verify role.', code: 'ROLE_CHECK_FAILED' }, { status: 500 });
    }
    if (!adminAccess.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: empProfile, error: profileErr } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (profileErr || !empProfile) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const { data: onboarding } = await adminSupabase
      .from('employee_onboarding')
      .select(`
        *,
        employer:employer_onboarding!employer_id (
          company_name
        )
      `)
      .eq('user_id', id)
      .maybeSingle();

    const { data: advances } = await adminSupabase
      .from('advances')
      .select('id, amount, fee_amount, status, created_at')
      .eq('employee_id', id)
      .order('created_at', { ascending: false });

    const advanceRows = (advances ?? []) as EmployeeAdvanceRow[];
    const outstandingStatuses = new Set(['processing', 'disbursed', 'completed']);

    const advanceStats = {
      advance_count: advanceRows.length,
      total_advances: advanceRows.reduce((sum, advance) => sum + Number(advance.amount || 0), 0),
      pending_repayment: advanceRows
        .filter((advance) => advance.status && outstandingStatuses.has(advance.status))
        .reduce((sum, advance) => sum + Number(advance.amount || 0), 0),
      total_fees_paid: advanceRows
        .filter((advance) => advance.status === 'repaid')
        .reduce((sum, advance) => sum + Number(advance.fee_amount || 0), 0),
    };

    const responseData = {
      id: empProfile.id,
      user_id: empProfile.id,
      employer_id: onboarding?.employer_id || null,
      employee_code: onboarding?.employee_code || empProfile.company_code || 'N/A',
      full_name: onboarding?.full_name || empProfile.full_name || 'Anonymous',
      email: empProfile.email,
      phone: empProfile.phone,
      national_id: onboarding?.national_id || null,
      country: onboarding?.country || null,
      job_title: onboarding?.job_title || 'Not Set',
      department: onboarding?.department || 'Not Set',
      monthly_salary: onboarding?.monthly_salary ? parseFloat(onboarding.monthly_salary as any) : 0,
      advance_limit: onboarding?.advance_limit || 0,
      earned_wages: onboarding?.earned_wages || 0,
      employment_type: onboarding?.employment_type || 'full-time',
      status: (onboarding?.status === 'approved' ? 'approved' : onboarding?.status || 'pending'),
      kyc_status: onboarding?.status || 'pending',
      risk_score: empProfile.metadata?.risk_score || null,
      employer_name: onboarding?.employer?.company_name || 'Unlinked',
      advance_stats: advanceStats,
      advances: advanceRows,
      created_at: empProfile.created_at,
      updated_at: onboarding?.updated_at || empProfile.created_at,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('[GET /api/admin/employees/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
