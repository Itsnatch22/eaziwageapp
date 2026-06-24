import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('sectors')
    .select('id, name, industry')
    .order('industry')
    .order('name');

  if (error) {
    console.error('[sectors/GET] DB error:', error);
    return NextResponse.json({ error: 'Failed to fetch sectors' }, { status: 500 });
  }

  return NextResponse.json(data);
}