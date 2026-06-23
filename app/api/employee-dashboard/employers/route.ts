import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const adminSupabase = createAdminClient();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';

  let query = adminSupabase
    .from('employers')
    .select('id, company_name, industry, city, country, countries_of_operation, status')
    .eq('status', 'approved')
    .order('company_name');

  if (q) {
    query = query.ilike('company_name', `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[employers/list]', error);
    return NextResponse.json({ error: 'Failed to fetch employers' }, { status: 500 });
  }

  return NextResponse.json({ employers: data ?? [] });
}