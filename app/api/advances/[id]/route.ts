import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { createRouteHandlerClient } from '@/utils/supabase/server';

const patchSchema = z.object({
  action: z.enum(['approve', 'deny']),
});

export async function PATCH(request: Request, { params }: IdRouteContext) {
  const { id } = await params;
  const supabase = await createRouteHandlerClient();

  const ip = (request.headers.get('x-forwarded-for')?.split(',')[0] ?? request.headers.get('cf-connecting-ip') ?? '0.0.0.0').trim();
  const rate = await checkRateLimit(apiLimiter, `advance-approve:${ip}`);
  if (!rate.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, role_normalized, is_admin')
    .eq('id', user.id)
    .maybeSingle<{ role: string | null; role_normalized: string | null; is_admin: boolean | null }>();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const userRole = (profile.role || profile.role_normalized || '').toLowerCase();
  const isAdmin = profile.is_admin === true;

  if (!isAdmin && !['admin', 'hr'].includes(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Ownership check — approver must belong to the same org as the advance.
  // Run all three lookups in parallel to keep latency low.
  const [advanceOrgRes, approverEmpRes, approverEmployerRes] = await Promise.all([
    supabase.from('advances').select('organization_id').eq('id', id).maybeSingle(),
    supabase.from('employees').select('organization_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('employers').select('onboarding_id').eq('user_id', user.id).maybeSingle(),
  ]);

  const advOrgId = advanceOrgRes.data?.organization_id ?? null;
  // HR users have an employee record; employer owners have an employers record
  const approverOrgId =
    approverEmpRes.data?.organization_id ??
    approverEmployerRes.data?.onboarding_id ??
    null;

  if (!advOrgId || !approverOrgId || advOrgId !== approverOrgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const requestBody = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(requestBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  const { action } = parsed.data;

  if (action === 'approve') {
    const { data: advance, error: advanceError } = await supabase.from('advances').select('id, employee_id, amount, status').eq('id', id).single();

    if (advanceError || !advance) {
      return NextResponse.json({ error: 'Advance request not found' }, { status: 404 });
    }

     const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('user_id, organization_id')
      .eq('id', advance.employee_id)
      .single();

    if (employeeError || !employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const { data: emp, error: empError } = await supabase
      .from('profiles')
      .select('salary')
      .eq('id', employee.user_id)
      .single();

    if (empError || !emp) {
      return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
    }

    const organization_id = employee.organization_id;

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
        .from('employer_onboarding')
        .select('max_advance_percentage, min_advance_amount, max_advance_amount')
       .eq('id', organization_id)
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

    const pct = (Number(effective.max_advance_percentage) || 50) / 100;
    const maxThisMonth = Number(emp.salary) * pct;

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data: approvedThisMonth } = await supabase
      .from('advances')
      .select('amount')
      .eq('employee_id', advance.employee_id)
      .eq('status', 'approved')
      .gte('requested_at', startOfMonth);

    const totalAccessed = (approvedThisMonth ?? []).reduce((sum, a: { amount: number | string | null }) => sum + Number(a.amount), 0);

    if (totalAccessed + Number(advance.amount) > maxThisMonth) {
      return NextResponse.json({ error: 'Monthly limit reached. Employee must settle pending advances first.' }, { status: 400 });
    }
  }

  const update = action === 'approve'
    ? { status: 'approved', approved_at: new Date().toISOString(), approved_by: user.id }
    : { status: 'rejected' };

  const approveAllowed = ['pending', 'failed'];
  const rejectAllowed = ['pending', 'approved'];
  const allowedStatuses = action === 'approve' ? approveAllowed : rejectAllowed;

  const { data: updatedAdvance, error: updateError } = await supabase
    .from('advances')
    .update(update)
    .eq('id', id)
    .in('status', allowedStatuses)
    .select('status')
    .maybeSingle<{ status: string | null }>();
  if (updateError) {
    console.error('[Approve advance] update error:', updateError);
    return NextResponse.json({ error: 'Failed to update advance status' }, { status: 500 });
  }

  if (!updatedAdvance) {
    const { data: currentAdvance, error: currentStatusError } = await supabase
      .from('advances')
      .select('status')
      .eq('id', id)
      .maybeSingle<{ status: string | null }>();

    if (currentStatusError) {
      console.error('[Approve advance] current status error:', currentStatusError);
      return NextResponse.json({ error: 'Failed to update advance status' }, { status: 500 });
    }

    return NextResponse.json(
      {
        error: `Advance cannot be ${action === 'approve' ? 'approved' : 'rejected'} from its current status`,
        status: currentAdvance?.status ?? null,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true, message: action === 'approve' ? 'Advance approved' : 'Advance rejected' });
}
