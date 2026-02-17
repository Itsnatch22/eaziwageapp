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
  company_code: string | null;
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

    const { data, error } = await supabase
      .from('employers')
      .select('id, company_name, company_code')
      .eq('status', 'approved')
      .order('company_name', { ascending: true });

    if (error) {
      console.error('[public-approved-employers] Query failed:', error);
      return NextResponse.json(
        { error: 'Failed to load approved employers.' },
        { status: 500, headers: rateResult.headers },
      );
    }

    const employers: EmployerRow[] = (data ?? [])
      .filter((row): row is EmployerRow => Boolean(row?.id && row?.company_code))
      .map((row) => ({
        id: row.id,
        company_name: row.company_name ?? row.company_code ?? 'Unknown company',
        company_code: row.company_code ?? '',
      }));

    return NextResponse.json(employers, { status: 200, headers: rateResult.headers });
  } catch (error) {
    console.error('[public-approved-employers] Unexpected error:', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
