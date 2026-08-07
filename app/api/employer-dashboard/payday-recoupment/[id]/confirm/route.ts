import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { dusupayClient } from '@/lib/dusupay/client';
import { PayoutMethod, Currency } from '@/lib/dusupay/types';
import { formatPhoneNumber, resolveProviderCode, COUNTRY_PROVIDER_PREFIXES } from '@/lib/dusupay/utils';
import { generatePaydayRecoupmentReference } from '@/lib/repayment/utils';
import { notifyAdmin } from '@/lib/notifications';
import { dbErrorResponse } from '@/lib/api-errors';

export const runtime = 'nodejs';

// Employer clicked "Yes" — actually initiate the DusuPay collection. The row only
// moves to 'collected' once the webhook confirms it (see app/api/webhook/dusupay/
// route.ts's EWAPAYDAY handling) — this route just gets the request accepted.
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
    .select('id, country, mobile_money_provider, mobile_money_number, company_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!employer) return NextResponse.json({ error: 'Employer not found' }, { status: 404 });

  const { data: recoupment, error: fetchError } = await adminSupabase
    .from('payday_recoupments')
    .select('*')
    .eq('id', id)
    .eq('employer_id', employer.id)
    .maybeSingle();

  if (fetchError) return dbErrorResponse('payday-recoupment/confirm', fetchError);
  if (!recoupment) return NextResponse.json({ error: 'Recoupment not found' }, { status: 404 });
  if (recoupment.status !== 'pending_response') {
    return NextResponse.json({ error: `Cannot confirm — status is '${recoupment.status}'` }, { status: 409 });
  }

  if (!employer.mobile_money_number || !employer.mobile_money_provider) {
    await adminSupabase.from('payday_recoupments').update({
      status: 'failed',
      failure_reason: 'No mobile money number on file for this employer',
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    await notifyAdmin({
      type: 'system_alert',
      title: 'Payday Recoupment Failed — Missing Mobile Money Details',
      message: `${employer.company_name || employer.id} confirmed a payday recoupment but has no mobile money number on file. Manual collection required.`,
      metadata: { employer_id: employer.id, recoupment_id: id },
    });

    return NextResponse.json({ error: 'No mobile money number on file. Set one in Settings first.' }, { status: 422 });
  }

  const providerCode = resolveProviderCode(employer.country, employer.mobile_money_provider);

  if (!providerCode) {
    await adminSupabase.from('payday_recoupments').update({
      status: 'failed',
      failure_reason: `Unrecognized mobile money provider "${employer.mobile_money_provider}" on file`,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    await notifyAdmin({
      type: 'system_alert',
      title: 'Payday Recoupment Failed — Unrecognized Mobile Money Provider',
      message: `${employer.company_name || employer.id} confirmed a payday recoupment but their mobile money provider "${employer.mobile_money_provider}" doesn't resolve to a known DusuPay provider code. Manual collection required.`,
      metadata: { employer_id: employer.id, recoupment_id: id, provider_name: employer.mobile_money_provider },
    });

    return NextResponse.json({ error: 'Mobile money provider on file is not recognized. Please update it in Settings.' }, { status: 422 });
  }

  if (!employer.country || !COUNTRY_PROVIDER_PREFIXES[employer.country]) {
    return NextResponse.json({ error: 'Unsupported or missing country code on file. Please update your Settings.' }, { status: 422 });
  }

  const dialCode = COUNTRY_PROVIDER_PREFIXES[employer.country];
  const msisdn = formatPhoneNumber(employer.mobile_money_number, dialCode);
  const merchantReference = generatePaydayRecoupmentReference(employer.id, recoupment.payday_date);

  // Atomically claim the row before calling DusuPay — same pattern as the
  // advance-request race fix. merchant_reference is deterministic per
  // recoupment, so a second concurrent request DusuPay never even sees would
  // still be deduped there, but claiming first means we only ever make one
  // outbound call instead of relying solely on DusuPay's own idempotency.
  const { data: claimed, error: claimError } = await adminSupabase
    .from('payday_recoupments')
    .update({
      status: 'collecting',
      merchant_reference: merchantReference,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending_response')
    .select('id')
    .maybeSingle();

  if (claimError) return dbErrorResponse('payday-recoupment/confirm', claimError);
  if (!claimed) {
    return NextResponse.json({ error: 'This recoupment was already confirmed.' }, { status: 409 });
  }

  let collectionResponse;
  try {
    collectionResponse = await dusupayClient.initializeCollection({
      merchant_reference: merchantReference,
      transaction_method: PayoutMethod.MOBILE_MONEY,
      currency: recoupment.currency as Currency,
      amount: Number(recoupment.amount_due),
      provider_code: providerCode,
      msisdn,
      customer_name: employer.company_name || 'EaziWage Employer',
      description: 'EaziWage advance recoupment',
      charge_customer: false,
      allow_final_status_change: true,
    });
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'Collection request failed';
    await adminSupabase.from('payday_recoupments').update({
      status: 'failed',
      failure_reason: reason,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    await notifyAdmin({
      type: 'system_alert',
      title: 'Payday Recoupment Collection Failed',
      message: `Collection request for ${employer.company_name || employer.id} failed: ${reason}`,
      metadata: { employer_id: employer.id, recoupment_id: id },
    });

    return NextResponse.json({ error: reason }, { status: 502 });
  }

  const { data: updated, error: updateError } = await adminSupabase
    .from('payday_recoupments')
    .update({
      internal_reference: collectionResponse.data?.internal_reference ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) return dbErrorResponse('payday-recoupment/confirm', updateError);

  return NextResponse.json({ success: true, recoupment: updated });
}
