// app/api/employees/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const COUNTRY_PCT: Record<string, number> = { KE: 0.60, UG: 0.40, RW: 0.50, TZ: 0.45 };

interface OrgProfile {
  organization_id: string;
}

interface Organization {
  country: string | null;
}

interface EmployeeProfile {
  id: string;
  name: string | null;
  full_name: string | null;
  department: string | null;
  monthly_salary: number | string | null;
  job_title: string | null;
  employee_code: string | null;
  status: string | null;
  kyc_status: string | null;
  [key: string]: unknown;
}

interface AdvanceRow {
  id: string;
  employee_id: string;
  amount: number | string | null;
  status: 'pending' | 'approved' | 'rejected' | string;
  requested_at: string;
}

export async function GET() {
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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'No org' }, { status: 400 });

	  const typedProfile = profile as OrgProfile;
	  const { data: org } = await supabase.from('organizations').select('country').eq('id', typedProfile.organization_id).single();
  const typedOrg = org as Organization | null;
  const country = typedOrg?.country || 'KE';
  const maxPct = COUNTRY_PCT[country] || 0.5;

  const { data: employees } = await supabase
    .from('employees')
    .select('*')
	    .eq('organization_id', typedProfile.organization_id)
	    .in('status', ['Active', 'pending', 'approved']);

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data: advances } = await supabase
    .from('advances')
    .select('*')
	    .eq('organization_id', typedProfile.organization_id)
	    .gte('requested_at', startOfMonth);

	  const advancesByEmp = ((advances || []) as AdvanceRow[]).reduce<Record<string, AdvanceRow[]>>((acc, a) => {
	    acc[a.employee_id] = acc[a.employee_id] || [];
	    acc[a.employee_id].push(a);
	    return acc;
	  }, {});

	  const computed = ((employees || []) as EmployeeProfile[]).map((emp) => {
	    const empAdvances = advancesByEmp[emp.id] || [];

	    const accessedMTD = empAdvances
	      .filter((a) => a.status === 'approved')
	      .reduce((sum, a) => sum + Number(a.amount), 0);

	    const latest = empAdvances.sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())[0];

    let status = latest ? (latest.status === 'pending' ? 'Pending' : latest.status === 'approved' ? 'Approved' : 'Denied') : (emp.status || 'Active');

    const maxAccess = Number(emp.monthly_salary || 0) * maxPct;
    if (accessedMTD >= maxAccess && latest?.status === 'pending') {
      status = 'Denied';
    }

    return {
      ...emp,
      name: emp.name || emp.full_name || 'Unknown',
      full_name: emp.full_name || emp.name || 'Unknown',
      department: emp.department || 'General',
      salary: Number(emp.monthly_salary || 0),
      withdrawnThisMonth: accessedMTD,
      status,
      pendingAdvanceId: empAdvances.find((a) => a.status === 'pending')?.id || null,
      maxAccess,
    };
  }) || [];

  return NextResponse.json({ employees: computed, country });
}
