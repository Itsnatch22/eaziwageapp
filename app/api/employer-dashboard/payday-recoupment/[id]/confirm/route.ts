import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { dusupayClient } from '@/lib/dusupay/client';
import { PayoutMethod, Currency } from '@/lib/dusupay/types';
import { formatPhoneNumber, resolveProviderCode, COUNTRY_PROVIDER_PREFIXES } from '@/lib/dusupay/utils';
import { generatePaydayRecoupmentReference } from '@/lib/repayment/utils';
import { notifyAdmin } from '@/lib/notifications';

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

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
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
  const dialCode = COUNTRY_PROVIDER_PREFIXES[employer.country ?? ''] ?? '254';
  const msisdn = formatPhoneNumber(employer.mobile_money_number, dialCode);
  const merchantReference = generatePaydayRecoupmentReference(employer.id, new Date(recoupment.payday_date));

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
      status: 'collecting',
      merchant_reference: merchantReference,
      internal_reference: collectionResponse.data?.internal_reference ?? null,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ success: true, recoupment: updated });
}
