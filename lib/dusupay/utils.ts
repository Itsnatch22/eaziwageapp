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
 * Maps a payment method's free-text provider_name (e.g. "Airtel", entered by the
 * employee at payment-method creation — there's no dropdown tied to DusuPay's real
 * provider list) to the exact provider_code DusuPay's API expects (e.g. "airtel_ke").
 * Falls back to the lowercased raw name if there's no match, so an unmapped provider
 * fails with DusuPay's own "invalid provider_code" error instead of a silent no-op —
 * that failure is at least diagnosable, unlike this function returning nothing.
 */
export function resolveProviderCode(countryCode: string | null | undefined, providerName: string): string {
  // Strip separators entirely rather than replacing with '_' — "M-Pesa" and "mpesa"
  // must normalize to the same key ("mpesa") to hit the map below.
  const key = providerName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const providers = MOBILE_MONEY_PROVIDERS[(countryCode ?? '').toUpperCase()] ?? {};
  return providers[key] ?? key;
}
