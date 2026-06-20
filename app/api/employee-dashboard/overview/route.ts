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

  const CACHE_TTL = 60; 
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
      id,
      user_id,
      employer_id,
      status,
      full_name,
      job_title,
      monthly_salary,
      bank_name,
      bank_account,
      mobile_money_provider,
      mobile_money_number,
      risk_score,
      country,
      created_at,
      updated_at,
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

  // Resolve employees.id from user_id for correct FK references
  const { data: employeeRecord, error: employeeRecordError } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (employeeRecordError || !employeeRecord) {
    return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
  }

  const liveEmployeeId = employeeRecord.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone_country_code')
    .eq('id', user.id)
    .maybeSingle();

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data: advances, error: advancesError } = await supabase
    .from('advances')
    .select('*')
    .eq('employee_id', liveEmployeeId)
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

  // Determine effective EWA settings (employee-specific -> employer onboarding)
  const { data: employeeEwa } = await supabase
    .from('employee_ewa_settings')
    .select('ewa_enabled, max_advance_percentage, min_advance_amount, max_advance_amount, cooldown_period')
    .eq('employee_id', liveEmployeeId)
    .maybeSingle();

  let effective = {
    ewa_enabled: true,
    max_advance_percentage: 50,
    min_advance_amount: 500,
    max_advance_amount: 50000,
    cooldown_period: 7,
  };

  if (employeeEwa) {
    effective = {
      ewa_enabled: employeeEwa.ewa_enabled ?? effective.ewa_enabled,
      max_advance_percentage: employeeEwa.max_advance_percentage ?? effective.max_advance_percentage,
      min_advance_amount: Number(employeeEwa.min_advance_amount ?? effective.min_advance_amount),
      max_advance_amount: Number(employeeEwa.max_advance_amount ?? effective.max_advance_amount),
      cooldown_period: Number(employeeEwa.cooldown_period ?? effective.cooldown_period),
    };
  } else {
    const { data: employerOnboarding } = await supabase
      .from('employer_onboarding')
      .select('max_advance_percentage, min_advance_amount, max_advance_amount, cooldown_period')
      .eq('id', employee.employer_id)
      .maybeSingle();

    if (employerOnboarding) {
      effective.max_advance_percentage = employerOnboarding.max_advance_percentage ?? effective.max_advance_percentage;
      effective.min_advance_amount = Number(employerOnboarding.min_advance_amount ?? effective.min_advance_amount);
      effective.max_advance_amount = Number(employerOnboarding.max_advance_amount ?? effective.max_advance_amount);
      effective.cooldown_period = Number(employerOnboarding.cooldown_period ?? effective.cooldown_period);
    }
  }

  // compute limit percentage
  const maxAccessPct = (Number(effective.max_advance_percentage) || 50) / 100;
  const totalAdvances = (advances || [])
    .filter(a => ['approved', 'disbursed'].includes(a.status))
    .reduce((sum, a) => sum + Number(a.amount), 0);

  let advanceLimit = Math.max(0, (earnedWages * maxAccessPct) - totalAdvances);

  // enforce global min/max
  if (advanceLimit < effective.min_advance_amount) advanceLimit = 0;
  if (effective.max_advance_amount && advanceLimit > effective.max_advance_amount) {
    advanceLimit = effective.max_advance_amount - totalAdvances;
    if (advanceLimit < 0) advanceLimit = 0;
  }

  const employerData = Array.isArray(employee.employer) 
    ? employee.employer[0] 
    : employee.employer;

  const currency = getCurrencyFromCountry(
    employerData?.country
      ?? employee.country
      ?? profile?.phone_country_code
      ?? (user.user_metadata?.phone_country_code as string | undefined),
    'KES',
  );

  const responseData = {
    employee: {
      id: employee.id,
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      employer_name: employerData?.company_name || 'N/A',
      job_title: employee.job_title || 'Employee',
      status: employee.status,
      kyc_status: employee.status,
      risk_score: employee.risk_score,
      bank_name: employee.bank_name || null,
      bank_account: employee.bank_account || null,
      mobile_money_provider: employee.mobile_money_provider || null,
      mobile_money_number: employee.mobile_money_number || null,
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
