// app/api/payroll/export/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
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
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // Fetch all advances for the organization
  const { data: advances } = await supabase
    .from('advances')
    .select(`
      id,
      amount,
      status,
      requested_at,
      approved_at,
      repaid_at,
      profiles (
        full_name,
        email,
        phone_number,
        country_code
      )
    `)
    .eq('organization_id', profile.organization_id)
    .order('requested_at', { ascending: false });

  if (!advances) {
    return NextResponse.json({ error: 'No data found' }, { status: 404 });
  }

  // Generate CSV
  const headers = [
    'Advance ID',
    'Employee Name',
    'Email',
    'Phone',
    'Country',
    'Amount',
    'Status',
    'Requested At',
    'Approved At',
    'Repaid At'
  ];

  const rows = advances.map((adv: any) => [
    adv.id,
    adv.profiles?.full_name || 'N/A',
    adv.profiles?.email || 'N/A',
    adv.profiles?.phone_number || 'N/A',
    adv.profiles?.country_code || 'N/A',
    adv.amount,
    adv.status,
    adv.requested_at ? new Date(adv.requested_at).toLocaleString() : 'N/A',
    adv.approved_at ? new Date(adv.approved_at).toLocaleString() : 'N/A',
    adv.repaid_at ? new Date(adv.repaid_at).toLocaleString() : 'N/A'
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename=eaziwage-payroll.csv',
    },
  });
}