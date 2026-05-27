// app/api/advances/[id]/route.ts
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

    const { data: org } = await supabase.from('organizations').select('country').eq('id', emp.organization_id).single();

    const limits: Record<string, number> = { KE: 0.6, UG: 0.4, RW: 0.5, TZ: 0.45 };
    const pct = limits[org?.country || 'KE'] || 0.5;
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
