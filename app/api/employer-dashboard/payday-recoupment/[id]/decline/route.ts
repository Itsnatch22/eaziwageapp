import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { notifyAdmin } from '@/lib/notifications';

export const runtime = 'nodejs';

// Employer clicked "No". This doesn't block anything on its own — it leaves the
// row unresolved, which is what app/api/employee-dashboard/request-advance's
// eligibility check gates new advance requests on (see checkEmployeeEligibility
// in lib/services/payout-service.ts).
export async function POST(
  req: NextRequest,
  { params }: IdRouteContext,
) {
  const { id } = await params;
  const supabase = await createRouteHandlerClient();
  const adminSupabase = createAdminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: employer } = await supabase
    .from('employers')
    .select('id, company_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!employer) return NextResponse.json({ error: 'Employer not found' }, { status: 404 });

  const { data: recoupment, error: fetchError } = await adminSupabase
    .from('payday_recoupments')
    .select('id, status')
    .eq('id', id)
    .eq('employer_id', employer.id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!recoupment) return NextResponse.json({ error: 'Recoupment not found' }, { status: 404 });
  if (recoupment.status !== 'pending_response') {
    return NextResponse.json({ error: `Cannot decline — status is '${recoupment.status}'` }, { status: 409 });
  }

  const { error: updateError } = await adminSupabase
    .from('payday_recoupments')
    .update({ status: 'declined', responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await notifyAdmin({
    type: 'system_alert',
    title: 'Payday Recoupment Declined',
    message: `${employer.company_name || employer.id} declined to recoup arrears on payday. Their employees' new advance requests will be blocked until this is resolved.`,
    metadata: { employer_id: employer.id, recoupment_id: id },
  });

  return NextResponse.json({ success: true });
}
