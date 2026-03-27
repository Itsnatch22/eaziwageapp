// app/api/overview/summary/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: org } = await supabase.from('organizations').select('liquidity_pool').eq('id', profile.organization_id).single();

  const { data: exposureData } = await supabase
    .from('advances')
    .select('amount')
    .eq('organization_id', profile.organization_id)
    .in('status', ['pending', 'approved']);

  const totalExposure = (exposureData ?? []).reduce((sum, a) => sum + Number(a.amount || 0), 0);

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data: mtdData } = await supabase
    .from('advances')
    .select('amount')
    .eq('organization_id', profile.organization_id)
    .eq('status', 'approved')
    .gte('requested_at', startOfMonth);

  const mtdDisbursed = (mtdData ?? []).reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const utilization = org?.liquidity_pool ? Math.round((mtdDisbursed / Number(org.liquidity_pool)) * 100) : 0;

  return NextResponse.json({
    totalExposure: Math.round(totalExposure),
    utilizationRate: utilization,
    fundsDisbursed: Math.round(mtdDisbursed),
    retentionScore: 94, 
  });
}