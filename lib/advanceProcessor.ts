import { getProviderByKey } from './providers/factory';
import { createRouteHandlerClient } from '@/utils/supabase/server';

export async function processApprovedAdvances(supabaseClient: any, limit = 20) {
  // fetch advances with status 'approved' (not yet processed)
  const { data: advances, error } = await supabaseClient
    .from('advances')
    .select('id, amount, net_amount, payment_method_id, payment_method_snapshot, reference, employee_id, employer_id')
    .eq('status', 'approved')
    .order('requested_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  if (!advances || advances.length === 0) return { processed: 0 };

  let processed = 0;

  for (const adv of advances) {
    try {
      // mark processing
      await supabaseClient
        .from('advances')
        .update({ status: 'processing' })
        .eq('id', adv.id);

      const pmSnapshot = adv.payment_method_snapshot || {};
      const pmId = adv.payment_method_id || pmSnapshot.id;

      // determine provider key from snapshot.provider_name or fallback mapping
      const providerKey = mapProviderNameToKey(pmSnapshot.provider_name || pmSnapshot.provider_name || '') || (pmSnapshot.method_type === 'bank_account' ? 'bank' : 'mpesa');

      const provider = await getProviderByKey(supabaseClient, providerKey, pmSnapshot.country_code || pmSnapshot.country);

      const payload = {
        reference: adv.reference,
        amount: adv.net_amount || adv.amount,
        currency: adv.currency || 'KES',
        phone_number: pmSnapshot.phone_number,
        account_number: pmSnapshot.account_number,
        account_name: pmSnapshot.account_name,
        advance_id: adv.id,
        employee_id: adv.employee_id,
        employer_id: adv.employer_id,
      };

      const result = await provider.initiateTransfer(payload);

      // record audit
      await supabaseClient.from('disbursement_audit').insert([{ advance_id: adv.id, payment_method_id: pmId, provider_key: providerKey, success: !!result.success, provider_reference: result.reference || null, response: result, error: result.error || null }]);

      if (result.success) {
        await supabaseClient.from('advances').update({ status: 'disbursed', disbursed_at: new Date().toISOString(), internal_reference: result.reference }).eq('id', adv.id);
      } else {
        await supabaseClient.from('advances').update({ status: 'failed', internal_reference: result.reference || null }).eq('id', adv.id);
      }

      processed++;
    } catch (err: any) {
      console.error('[advanceProcessor] failed processing advance', adv?.id, err?.message || err);
      try {
        await supabaseClient.from('disbursement_audit').insert([{ advance_id: adv.id, payment_method_id: adv.payment_method_id || null, provider_key: null, success: false, error: err?.message || String(err) }]);
        await supabaseClient.from('advances').update({ status: 'failed' }).eq('id', adv.id);
      } catch (e) {
        console.error('[advanceProcessor] failed to record failure', e);
      }
    }
  }

  return { processed };
}

function mapProviderNameToKey(name: string | undefined) {
  if (!name) return undefined;
  const n = name.toLowerCase();
  if (n.includes('mpesa') || n.includes('m-pesa')) return 'mpesa';
  if (n.includes('airtel')) return 'airtel';
  if (n.includes('mtn')) return 'mtn';
  if (n.includes('tigo')) return 'tigo';
  if (n.includes('bank')) return 'bank';
  return undefined;
}
