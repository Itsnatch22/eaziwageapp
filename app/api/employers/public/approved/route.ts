import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';

const env = getEnv();

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

type EmployerRow = {
  id: string;
  company_name: string | null;
  employer_code: string | null;
};

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      'anonymous';

    const rateResult = await checkRateLimit(apiLimiter, ip);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: rateResult.headers },
      );
    }

    // 1. Fetch from 'employers' table (synced approved employers)
    const { data: employersData, error: employersError } = await supabase
      .from('employers')
      .select('id, company_name, employer_code, user_id')
      .eq('status', 'approved');

    // 2. Fetch from 'employer_onboarding' table (source of truth for status)
    const { data: onboardingData, error: onboardingError } = await supabase
      .from('employer_onboarding')
      .select('id, company_name, status, user_id')
      .eq('status', 'approved');

    if (employersError || onboardingError) {
      console.error('[public-approved-employers] Query failed:', employersError || onboardingError);
      return NextResponse.json(
        { error: 'Failed to load approved employers.' },
        { status: 500, headers: rateResult.headers },
      );
    }

    // Collect all user IDs to fetch company codes from profiles
    const userIds = new Set<string>();
    employersData?.forEach(e => { if (e.user_id) userIds.add(e.user_id); });
    onboardingData?.forEach(e => { if (e.user_id) userIds.add(e.user_id); });

    // 3. Fetch company_code from profiles
    const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, company_code')
        .in('id', Array.from(userIds));
    
    const codeMap = new Map(profilesData?.map(p => [p.id, p.company_code]) ?? []);

    // Combine and deduplicate
    const companyMap = new Map<string, { id: string; company_name: string; company_code: string }>();

    onboardingData?.forEach((row) => {
        const code = codeMap.get(row.user_id) || `EW-${row.id.slice(0, 8).toUpperCase()}`;
        companyMap.set(row.id, {
            id: row.id,
            company_name: row.company_name ?? 'Unknown Company',
            company_code: code
        });
    });

    employersData?.forEach((row) => {
        const code = row.employer_code || codeMap.get(row.user_id) || `EW-${row.id.slice(0, 8).toUpperCase()}`;
        companyMap.set(row.id, {
            id: row.id,
            company_name: row.company_name ?? 'Unknown Company',
            company_code: code
        });
    });

    const employers = Array.from(companyMap.values()).sort((a, b) => 
        a.company_name.localeCompare(b.company_name)
    );

    return NextResponse.json(employers, { status: 200, headers: rateResult.headers });
  } catch (error) {
    console.error('[public-approved-employers] Unexpected error:', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
