import { createClient } from '@/lib/client';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('sectors')
    .select('id, name, industry')
    .order('industry')
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}