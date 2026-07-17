import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrencyFromCountry } from '@/lib/utils';
import { getEnv } from '@/env';
import { Redis } from '@upstash/redis';
import { dbErrorResponse } from '@/lib/api-errors';
import { OUTSTANDING_STATUSES } from '@/lib/constants/advance-status';

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

  const CACHE_TTL = 10;
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
      submitted_at,
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
    return dbErrorResponse('employee-dashboard/overview', employeeError);
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


  const { data: employeeRecord } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  // employees row may not exist yet (KYC pending / sync lag).
  // Fall back to null — advances will be empty, which is correct for new employees.
  const liveEmployeeId = employeeRecord?.id ?? null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone_country_code')
    .eq('id', user.id)
    .maybeSingle();

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const advances = liveEmployeeId
    ? await supabase
        .from('advances')
        .select('*')
        .eq('employee_id', liveEmployeeId)
        .gte('created_at', startOfMonth)
        .order('created_at', { ascending: false })
        .then(({ data }) => data ?? [])
    : [];

  const monthlySalary = Number(employee.monthly_salary || 0);
  
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysPassed = today.getDate();
  const earnedWages = (monthlySalary / daysInMonth) * daysPassed;


  const { data: employeeEwa } = liveEmployeeId
    ? await supabase
        .from('employee_ewa_settings')
        .select('ewa_enabled, max_advance_percentage, min_advance_amount, max_advance_amount, cooldown_period')
        .eq('employee_id', liveEmployeeId)
        .maybeSingle()
    : { data: null };

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
    // SCHEMA: advance eligibility lives in employers (advance_limit_percent, cooldown_days),
    // not in employer_onboarding (max_advance_percentage, cooldown_period). Do not swap.
    const { data: employerRow, error: employerRowError } = await supabase
      .from('employers')
      .select('advance_limit_percent, min_advance_amount, max_advance_amount, cooldown_days')
      .eq('onboarding_id', employee.employer_id)
      .maybeSingle();

    if (employerRowError) {
      return dbErrorResponse('employee-dashboard/overview', employerRowError);
    }

    if (employerRow) {
      effective.max_advance_percentage = employerRow.advance_limit_percent ?? effective.max_advance_percentage;
      effective.min_advance_amount = Number(employerRow.min_advance_amount ?? effective.min_advance_amount);
      effective.max_advance_amount = Number(employerRow.max_advance_amount ?? effective.max_advance_amount);
      effective.cooldown_period = Number(employerRow.cooldown_days ?? effective.cooldown_period);
    }
    // No employers row — use hardcoded defaults initialised above.
  }


  const maxAccessPct = (Number(effective.max_advance_percentage) || 50) / 100;
  const totalAdvances = (advances || [])
    .filter(a => ['pending', 'processing', 'approved', ...OUTSTANDING_STATUSES].includes(a.status))
    .reduce((sum, a) => sum + Number(a.amount), 0);

  let advanceLimit = Math.max(0, (earnedWages * maxAccessPct) - totalAdvances);


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
      // 'pending' status alone doesn't distinguish a brand-new registration
      // stub (nothing submitted yet — app/api/employee-dashboard/onboarding
      // POST calls this "isRegistrationStub") from a real submission
      // genuinely awaiting review, since employee_onboarding has no distinct
      // status for either. submitted_at is the actual signal.
      submitted_at: employee.submitted_at,
      risk_score: employee.risk_score,
      bank_name: employee.bank_name || null,
      bank_account: employee.bank_account || null,
      mobile_money_provider: employee.mobile_money_provider || null,
      mobile_money_number: employee.mobile_money_number || null,
      profile_picture_url: user.user_metadata?.avatar_url,
      currency,
      created_at: employee.created_at,
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
