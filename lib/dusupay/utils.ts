import { MOBILE_MONEY_PROVIDERS } from '@/lib/dusupay';

export function generateMerchantReference(advanceId: string): string {
  // DusuPay requires merchant_reference to be <= 36 chars. The old
  // `ADV-${advanceId}-${Date.now()}` format was ~54 chars (advanceId alone is a
  // 36-char UUID) and rejected on every call. Stripping the UUID's hyphens and
  // dropping the timestamp fits comfortably under the limit (3 + 32 = 35 chars)
  // and, as a side effect, makes the reference deterministic per advance — which
  // is what "used as an idempotency key" (see CLAUDE.md) actually requires: a
  // retried disbursement for the same advance now reuses the same reference
  // instead of minting a new one DusuPay would treat as an unrelated transaction.
  return `ADV${advanceId.replace(/-/g, '')}`;
}

export function formatPhoneNumber(phone: string, countryCode: string = '254'): string {
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('0')) {
    cleaned = countryCode + cleaned.substring(1);
  }
  
  if (!cleaned.startsWith(countryCode)) {
    cleaned = countryCode + cleaned;
  }
  
  return cleaned;
}

export const COUNTRY_PROVIDER_PREFIXES: Record<string, string> = {
  'KE': '254',
  'UG': '256',
  'TZ': '255',
  'RW': '250',
};

/**
 * Maps a payment method's provider_name (e.g. "Airtel Money") to the exact
 * provider_code DusuPay's API expects (e.g. "airtel_ke"). provider_name is
 * now validated against payout_providers at payment-method creation time
 * (see lib/paymentMethodsService.ts), but this still returns null rather than
 * guessing on no match — as defense-in-depth for any pre-existing
 * unvalidated record, and for the payday-recoupment caller, which resolves
 * an employer's free-text mobile_money_provider field (not yet covered by
 * that validation). Callers MUST treat null as "do not call DusuPay" — a
 * previous version fell back to the lowercased raw text, which meant an
 * unmapped provider still reached a live payout call with a guessed code.
 */
export function resolveProviderCode(countryCode: string | null | undefined, providerName: string): string | null {
  // Strip separators entirely rather than replacing with '_' — "M-Pesa" and "mpesa"
  // must normalize to the same key ("mpesa") to hit the map below.
  const key = providerName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const providers = MOBILE_MONEY_PROVIDERS[(countryCode ?? '').toUpperCase()] ?? {};
  return providers[key] ?? null;
}
