import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const supabase = await createRouteHandlerClient();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';

  // 'employers: public read approved' RLS policy allows this without service-role
  let query = supabase
    .from('employers')
    .select('id, company_name, company_code, industry, city, country, countries_of_operation, status')
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