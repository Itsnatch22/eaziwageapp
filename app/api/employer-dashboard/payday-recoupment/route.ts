import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { checkAndCreatePaydayRecoupment } from '@/lib/services/payday-recoupment-service';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createRouteHandlerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: employer } = await supabase
    .from('employers')
    .select('id, payday_day_of_month, company_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!employer) {
    return NextResponse.json({ recoupment: null });
  }

  // Past-cycle unresolved rows feed the arrears gate on new advance requests
  // (see the eligibility check in payout-service.ts).
  const recoupment = await checkAndCreatePaydayRecoupment(
    employer.id,
    user.id,
    employer.company_name,
    employer.payday_day_of_month,
  );

  return NextResponse.json({ recoupment });
}
