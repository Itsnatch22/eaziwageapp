import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/env';

export const runtime = 'nodejs';

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const adminSupabase = createAdminClient();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';

  let query = adminSupabase
    .from('employer_onboarding')
    .select('id, company_name, industry, city, country, countries_of_operation, status')
    .eq('status', 'approved')
    .order('company_name');

  if (q) {
    query = query.ilike('company_name', `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[employers/list]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ employers: data ?? [] });
}