import { SupabaseClient } from '@supabase/supabase-js';
import { GenericHttpProvider } from './genericHttpProvider';
import type { PayoutProvider } from '@/lib/payoutProviders';

export async function getProviderByKey(supabaseClient: SupabaseClient, providerKey: string, countryCode?: string): Promise<PayoutProvider> {

  let q = supabaseClient.from('payout_providers').select('id, country_code, provider_key, provider_name, method_type, config, enabled');
  if (countryCode) q = q.eq('country_code', countryCode);
  q = q.eq('provider_key', providerKey).limit(1);

  const res = await q.maybeSingle();
  let row = res?.data;
  if (!row) {
    const fallback = await supabaseClient.from('payout_providers').select('id, country_code, provider_key, provider_name, method_type, config, enabled').eq('provider_key', providerKey).limit(1).maybeSingle();
    row = fallback?.data;
  }

  if (!row) throw new Error('Payout provider not found');
  if (!row.enabled) throw new Error('Payout provider disabled');

  const config = row.config || {};
  return new GenericHttpProvider(config);
}
