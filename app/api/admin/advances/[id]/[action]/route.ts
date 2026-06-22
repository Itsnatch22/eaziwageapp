import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NextResponse, NextRequest } from 'next/server';
import { checkAdminAccess } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  context: AppRouteContext<{ id: string; action: string }>
) {
  const { id, action } = await context.params;
  const supabase = await createRouteHandlerClient();
  
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminResult = await checkAdminAccess({
    user,
    adminSupabase: supabase,
  });

  if (!adminResult.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!['approve', 'disburse', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  try {
    const { data: advance, error: getError } = await supabase
      .from('advances')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (getError || !advance) {
      return NextResponse.json({ error: 'Advance not found' }, { status: 404 });
    }

    let newStatus: string;
    if (action === 'approve') {
      newStatus = 'approved';
    } else if (action === 'disburse') {
      newStatus = 'disbursed';
    } else if (action === 'reject') {
      newStatus = 'rejected';
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { data: employeeEwa } = await supabase
      .from('employee_ewa_settings')
      .select('ewa_enabled, max_advance_percentage, min_advance_amount, max_advance_amount')
      .eq('employee_id', advance.employee_id)
      .maybeSingle();

    let effective = {
      ewa_enabled: true,
      max_advance_percentage: 50,
      min_advance_amount: 500,
      max_advance_amount: 50000,
    };

    if (employeeEwa) {
      effective = {
        ewa_enabled: employeeEwa.ewa_enabled ?? effective.ewa_enabled,
        max_advance_percentage: employeeEwa.max_advance_percentage ?? effective.max_advance_percentage,
        min_advance_amount: Number(employeeEwa.min_advance_amount ?? effective.min_advance_amount),
        max_advance_amount: Number(employeeEwa.max_advance_amount ?? effective.max_advance_amount),
      };
    } else {
      const { data: employerOnboarding } = await supabase
        .from('employers')
        .select('max_advance_percentage, min_advance_amount, max_advance_amount')
        .eq('id', advance.employer_id)
        .maybeSingle();
      if (employerOnboarding) {
        effective.max_advance_percentage = employerOnboarding.max_advance_percentage ?? effective.max_advance_percentage;
        effective.min_advance_amount = Number(employerOnboarding.min_advance_amount ?? effective.min_advance_amount);
        effective.max_advance_amount = Number(employerOnboarding.max_advance_amount ?? effective.max_advance_amount);
      }
    }

    if (effective.ewa_enabled === false) {
      return NextResponse.json({ error: 'EWA access is disabled for this employee.' }, { status: 403 });
    }

    if (Number(advance.amount) < effective.min_advance_amount || Number(advance.amount) > effective.max_advance_amount) {
      return NextResponse.json({ error: 'Advance amount falls outside configured EWA limits.' }, { status: 422 });
    }

    const { error: updateError } = await supabase
      .from('advances')
      .update({
        status: newStatus,
        approved_at: newStatus === 'approved' ? new Date().toISOString() : advance.approved_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Advance ${newStatus}`,
      advance_id: id,
    });
  } catch (error: unknown) {
    console.error('[AdminAdvancesAction] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
