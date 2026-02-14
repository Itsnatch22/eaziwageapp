// app/api/payroll/statement/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
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
  const { period } = await request.json(); // '3m' | '6m' | '12m'

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // Data maturity check
  const { data: firstCycle } = await supabase
    .from('payroll_cycles')
    .select('created_at')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  const monthsOnPlatform = firstCycle 
    ? Math.floor((Date.now() - new Date(firstCycle.created_at).getTime()) / (30 * 24 * 60 * 60 * 1000))
    : 0;

  const allowed = {
    '3m': monthsOnPlatform >= 2,
    '6m': monthsOnPlatform >= 5,
    '12m': monthsOnPlatform >= 11,
  };

  if (!allowed[period as keyof typeof allowed]) {
    return NextResponse.json({ error: 'Period not available yet' }, { status: 403 });
  }

  // Fetch data for the period (simplified)
  const { data: data } = await supabase
    .from('advances')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .eq('status', 'approved');

  // In production: generate PDF with @react-pdf/renderer here and upload to Supabase Storage

  await supabase.from('statements').insert({
    organization_id: profile.organization_id,
    period,
    generated_by: user.id,
    // file_url: uploadedUrl
  });

  return NextResponse.json({
    success: true,
    preview: {
      period,
      totalDisbursed: data?.reduce((sum: number, a: any) => sum + Number(a.amount), 0) || 0,
      records: data?.length || 0,
    }
  });
}