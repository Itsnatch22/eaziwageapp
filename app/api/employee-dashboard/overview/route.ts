import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrencyFromCountry } from '@/lib/utils';
import { getEnv } from '@/env';
import { Redis } from '@upstash/redis';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const env = getEnv();
  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  const CACHE_TTL = 60; // 1 minute cache
  const cacheKey = `employee:overview:${user.id}`;

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(`[EmployeeOverview] Cache hit for ${user.id}`);
      return NextResponse.json(cachedData, { 
        headers: { 'X-Cache': 'HIT' } 
      });
    }
  } catch (cacheError) {
    console.warn('[EmployeeOverview] Cache check failed:', cacheError);
  }

  const { data: employee, error: employeeError } = await supabase
    .from('employee_onboarding')
    .select(`
      *,
      employer:employer_id (
        id,
        company_name,
        risk_score,
        country
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (employeeError) {
    return NextResponse.json({ error: employeeError.message }, { status: 500 });
  }

  if (!employee) {
    return NextResponse.json({ 
      message: 'Profile not found', 
      code: 'profile_not_found',
      user: {
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        email: user.email,
        profile_picture_url: user.user_metadata?.avatar_url,
      }
    }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone_country_code')
    .eq('id', user.id)
    .maybeSingle();

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data: advances, error: advancesError } = await supabase
    .from('advances')
    .select('*')
    .eq('employee_id', employee.id)
    .gte('created_at', startOfMonth)
    .order('created_at', { ascending: false });

  if (advancesError) {
    return NextResponse.json({ error: advancesError.message }, { status: 500 });
  }

  const monthlySalary = Number(employee.monthly_salary || 0);
  
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysPassed = today.getDate();
  const earnedWages = (monthlySalary / daysInMonth) * daysPassed;

  const maxAccessPct = 0.5; 
  const totalAdvances = (advances || [])
    .filter(a => ['approved', 'disbursed'].includes(a.status))
    .reduce((sum, a) => sum + Number(a.amount), 0);
  
  const advanceLimit = Math.max(0, (earnedWages * maxAccessPct) - totalAdvances);

  const currency = getCurrencyFromCountry(
    employee.employer?.country
      ?? employee.country
      ?? profile?.phone_country_code
      ?? (user.user_metadata?.phone_country_code as string | undefined),
    'KES',
  );

  const responseData = {
    employee: {
      id: employee.id,
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      employer_name: employee.employer?.employer_id || 'N/A',
      job_title: employee.job_title || 'Employee',
      status: employee.status,
      kyc_status: employee.status, 
      profile_picture_url: user.user_metadata?.avatar_url,
      currency,
    },
    stats: {
      earned_wages: earnedWages,
      advance_limit: advanceLimit,
      total_advances: totalAdvances,
      recent_transactions: (advances || []).slice(0, 5),
    },
    user: {
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        email: user.email,
        profile_picture_url: user.user_metadata?.avatar_url,
    }
  };

  try {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(responseData));
  } catch (cacheError) {
    console.warn('[EmployeeOverview] Cache set failed:', cacheError);
  }

  return NextResponse.json(responseData, { 
    headers: { 'X-Cache': 'MISS' } 
  });
}
