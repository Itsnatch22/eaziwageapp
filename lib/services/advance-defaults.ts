import type { SupabaseClient } from '@supabase/supabase-js';
import { getCurrencyFromCountry } from '@/lib/utils';

// The historical Kenya-only defaults (500 / 50000 KES) baked into the employers
// table's column defaults and several onboarding-promotion code paths — kept here
// as the baseline USD-equivalent so non-Kenya employers get a proportional figure
// in their own currency instead of the same raw KES-shaped number.
const BASELINE_CURRENCY = 'KES';
const BASELINE_MIN_ADVANCE_AMOUNT = 500;
const BASELINE_MAX_ADVANCE_AMOUNT = 50000;

export interface DefaultAdvanceRange {
  min_advance_amount: number;
  max_advance_amount: number;
}

// Scales the KES baseline min/max advance amount into an employer's own local
// currency using the live exchange_rates table, so e.g. a Ugandan employer gets
// UGX-denominated defaults instead of the same raw KES figures. Falls back to the
// KES baseline unchanged if the employer's currency or a rate is unresolvable.
export async function resolveDefaultAdvanceRange(
  adminSupabase: SupabaseClient,
  country: string | null | undefined
): Promise<DefaultAdvanceRange> {
  const currency = getCurrencyFromCountry(country, BASELINE_CURRENCY);

  if (currency === BASELINE_CURRENCY) {
    return { min_advance_amount: BASELINE_MIN_ADVANCE_AMOUNT, max_advance_amount: BASELINE_MAX_ADVANCE_AMOUNT };
  }

  const { data: rates } = await adminSupabase
    .from('exchange_rates')
    .select('currency_code, rate_to_usd')
    .in('currency_code', [BASELINE_CURRENCY, currency]);

  const baselineRate = rates?.find((r) => r.currency_code === BASELINE_CURRENCY)?.rate_to_usd;
  const targetRate = rates?.find((r) => r.currency_code === currency)?.rate_to_usd;

  if (!baselineRate || !targetRate) {
    return { min_advance_amount: BASELINE_MIN_ADVANCE_AMOUNT, max_advance_amount: BASELINE_MAX_ADVANCE_AMOUNT };
  }

  const ratio = Number(targetRate) / Number(baselineRate);

  return {
    min_advance_amount: Math.round(BASELINE_MIN_ADVANCE_AMOUNT * ratio),
    max_advance_amount: Math.round(BASELINE_MAX_ADVANCE_AMOUNT * ratio),
  };
}
