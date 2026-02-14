// app/api/payroll/summary/route.ts
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
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
  const { data: org } = await supabase.from('organizations').select('liquidity_pool, country').eq('id', profile.organization_id).single();

  if (!org) return NextResponse.json({ error: 'No org' }, { status: 400 });

  const now = new Date();
  const currentMonth = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const settlementDate = new Date(now.getFullYear(), now.getMonth(), 15);
  const daysToSettlement = Math.ceil((settlementDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isOpen = daysToSettlement <= 0;

  // Aggregates from advances
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfRolling = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const { data: advances } = await supabase
    .from('advances')
    .select('amount, requested_at, country_code')
    .eq('organization_id', profile.organization_id)
    .eq('status', 'approved')
    .gte('requested_at', startOfRolling);

  const mtd = advances?.filter(a => a.requested_at >= startOfMonth) || [];
  const today = advances?.filter(a => a.requested_at >= startOfToday) || [];
  const rolling = advances || [];

  const disbursedMTD = mtd.reduce((sum, a) => sum + Number(a.amount), 0);
  const disbursedToday = today.reduce((sum, a) => sum + Number(a.amount), 0);
  const disbursedRolling = rolling.reduce((sum, a) => sum + Number(a.amount), 0);

  // Daily sparkline (last 14 days)
  const daily: number[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStart = d.toISOString().split('T')[0];
    const daySum = (advances || [])
      .filter(a => a.requested_at.startsWith(dayStart))
      .reduce((sum, a) => sum + Number(a.amount), 0);
    daily.push(daySum);
  }

  // Liquidity utilisation
  const liquidityUtil = org.liquidity_pool ? (disbursedMTD / Number(org.liquidity_pool)) * 100 : 0;
  let utilColor = 'emerald';
  if (liquidityUtil > 95) utilColor = 'red';
  else if (liquidityUtil > 80) utilColor = 'amber';

  // Country utilisation (multi-country)
  const countryMap: Record<string, { disbursed: number; employees: number }> = {};
  const { data: employees } = await supabase.from('profiles').select('country_code, salary').eq('organization_id', profile.organization_id);

  employees?.forEach(emp => {
    const cc = emp.country_code || org.country || 'KE';
    if (!countryMap[cc]) countryMap[cc] = { disbursed: 0, employees: 0 };
    countryMap[cc].employees++;
  });

  (advances || []).forEach(a => {
    const cc = a.country_code || 'KE';
    if (countryMap[cc]) countryMap[cc].disbursed += Number(a.amount);
  });

  const countryUtils = Object.entries(countryMap).map(([code, data]) => ({
    code,
    util: data.employees ? Math.round((data.disbursed / (data.employees * 50000)) * 100) : 0, // rough per-employee avg
  }));

  // Reconciliation preview
  const feesAccrued = Math.round(disbursedMTD * 0.02); // 2% access fee (configurable later)
  const expectedSettlement = disbursedMTD + feesAccrued;
  const netAdjustment = -disbursedMTD; // what employer will be debited

  return NextResponse.json({
    currentCycle: currentMonth,
    settlement: { 
      status: isOpen ? 'OPEN' : 'PENDING', 
      days: isOpen ? 0 : daysToSettlement,
      color: isOpen ? 'emerald' : 'slate'
    },
    disbursed: {
      mtd: disbursedMTD,
      today: disbursedToday,
      rolling12: disbursedRolling,
    },
    feesAccrued,
    dailySpark: daily,
    liquidityUtil: Math.round(liquidityUtil),
    utilColor,
    reconciliation: {
      expectedSettlement,
      totalAdvances: disbursedMTD,
      feesCovered: feesAccrued,
      netAdjustment,
    },
    countryUtils,
  });
}