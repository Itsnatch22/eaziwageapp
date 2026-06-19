import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );

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

  const requestBody = await request.json();
  const action = typeof requestBody?.action === 'string' ? requestBody.action : null;

  if (action !== 'approve' && action !== 'deny') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  if (action === 'approve') {
    const { data: advance, error: advanceError } = await supabase.from('advances').select('*').eq('id', id).single();

    if (advanceError || !advance) {
      return NextResponse.json({ error: 'Advance request not found' }, { status: 404 });
    }

    const { data: emp, error: empError } = await supabase.from('profiles').select('salary, organization_id').eq('id', advance.employee_id).single();

    if (empError || !emp) {
      return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
    }

    // Respect per-employee or employer EWA settings when enforcing monthly cap
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
        .eq('id', emp.organization_id)
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
    : { status: 'denied' };

  const { error: updateError } = await supabase.from('advances').update(update).eq('id', id);
  if (updateError) {
    console.error('[Approve advance] update error:', updateError);
    return NextResponse.json({ error: 'Failed to update advance status' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: `Advance ${action}d` });
}
