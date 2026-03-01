import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();

  // 1. Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Fetch employee
  const { data: employee } = await supabase
    .from('employee_onboarding')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!employee) {
    return NextResponse.json([]);
  }

  // 3. Fetch all advances/transactions
  const { data: transactions, error } = await supabase
    .from('advances')
    .select('*')
    .eq('employee_id', employee.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(transactions || []);
}
