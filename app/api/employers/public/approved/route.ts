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

    // employer_onboarding.company_code is the canonical source — populated at
    // registration and at admin approval. The employers table is a secondary
    // source for fully-migrated records that pre-date the onboarding column.
    const [{ data: onboardingData, error: onboardingError }, { data: employersData, error: employersError }] =
      await Promise.all([
        supabase
          .from('employer_onboarding')
          .select('id, company_name, company_code')
          .eq('status', 'approved')
          .not('company_code', 'is', null),
        supabase
          .from('employers')
          .select('id, company_name, company_code, employer_code, onboarding_id')
          .eq('status', 'approved'),
      ]);

    if (onboardingError || employersError) {
      console.error('[public-approved-employers] Query failed:', onboardingError || employersError);
      return NextResponse.json(
        { error: 'Failed to load approved employers.' },
        { status: 500, headers: rateResult.headers },
      );
    }

    // Build a merged list, keyed by onboarding_id to avoid duplicates.
    // employer_onboarding rows win; employers rows fill in any gaps.
    const companyMap = new Map<string, { id: string; company_name: string; company_code: string }>();

    // Primary: onboarding records with real codes
    for (const row of onboardingData ?? []) {
      if (row.company_code) {
        companyMap.set(row.id, {
          id: row.id,
          company_name: row.company_name ?? 'Unknown Company',
          company_code: row.company_code,
        });
      }
    }

    // Secondary: employers records for any approved employers not yet in onboarding map
    for (const row of employersData ?? []) {
      const code = row.company_code || row.employer_code;
      if (!code) continue;
      // onboarding_id links employers → employer_onboarding; prefer onboarding entry if present
      const key = row.onboarding_id ?? row.id;
      if (!companyMap.has(key)) {
        companyMap.set(key, {
          id: key,
          company_name: row.company_name ?? 'Unknown Company',
          company_code: code,
        });
      }
    }

    const employers = Array.from(companyMap.values()).sort((a, b) =>
      a.company_name.localeCompare(b.company_name),
    );

    return NextResponse.json(employers, { status: 200, headers: rateResult.headers });
  } catch (error) {
    console.error('[public-approved-employers] Unexpected error:', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
