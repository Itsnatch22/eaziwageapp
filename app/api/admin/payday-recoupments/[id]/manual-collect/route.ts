import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { applyPaydayRecoupmentCollection } from '@/lib/services/payday-recoupment-service';
import { notifyEmployer } from '@/lib/notifications';
import { requestLogger } from '@/lib/logger';
import { dbErrorResponse } from '@/lib/api-errors';

export const runtime = 'nodejs';

// Manual bank-transfer fallback for when automated mobile money collection failed
// (DusuPay has no bank-debit collection method for KES/UGX/TZS/RWF). Admin confirms
// they've received the transfer into the company's bank account outside DusuPay,
// then this applies it across outstanding schedules the same way the webhook does.
export async function POST(
  req: NextRequest,
  { params }: IdRouteContext,
) {
  const { id } = await params;
  const log = requestLogger('admin-payday-recoupment-manual-collect', req);

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { user, adminSupabase } = auth;

  const { data: recoupment, error: fetchError } = await adminSupabase
    .from('payday_recoupments')
    .select('id, employer_id, amount_due, status')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return dbErrorResponse('admin/payday-recoupments/manual-collect', fetchError);
  if (!recoupment) return NextResponse.json({ error: 'Recoupment not found' }, { status: 404 });
  const allowedStatuses = ['failed', 'pending_response', 'partially_collected', 'confirmed'];
  if (!allowedStatuses.includes(recoupment.status)) {
    return NextResponse.json({ error: `Cannot manually collect — status is '${recoupment.status}'` }, { status: 409 });
  }

  const { data: employer } = await adminSupabase
    .from('employers')
    .select('user_id, company_name')
    .eq('id', recoupment.employer_id)
    .maybeSingle();

  const paymentReference = `MANUAL-BANK-${recoupment.id.slice(0, 8).toUpperCase()}`;

  await applyPaydayRecoupmentCollection(
    recoupment.id,
    recoupment.employer_id,
    Number(recoupment.amount_due),
    paymentReference,
    log,
  );

  const { error: auditError } = await adminSupabase.from('system_audit_logs').insert({
    admin_id: user.id,
    admin_name: user.email,
    target_id: recoupment.id,
    target_type: 'payday_recoupment',
    action: 'payday_recoupment_manual_collect',
    old_value: { status: recoupment.status },
    new_value: { status: 'collected', method: 'manual_bank_transfer', amount: recoupment.amount_due },
  });
  if (auditError) console.error('[audit] payday_recoupment_manual_collect error:', auditError);

  if (employer?.user_id) {
    void notifyEmployer({
      userId: employer.user_id,
      type: 'system',
      title: 'Payday Recoupment Settled',
      message: `Your bank transfer for ${recoupment.amount_due} has been confirmed and applied to your outstanding balance.`,
      metadata: { recoupment_id: recoupment.id },
    }).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
