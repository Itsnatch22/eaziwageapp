// app/api/employee-dashboard/employers/route.ts
//
// Returns a list of approved employers for the employee onboarding form.
// Reads from the `approved_employers` view which filters employer_onboarding
// to status = 'approved' only.
//
import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  // Auth guard — only logged-in users can see employer list
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Optional search filter from query string: ?q=safaricom
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';

  let query = supabase
    .from('approved_employers')
    .select('id, company_name, industry, city, country, countries_of_operation')
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