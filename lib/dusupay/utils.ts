/**
 * Generates a unique merchant reference for a transaction
 * Format: ADV-{advanceId}-{timestamp}
 */
export function generateMerchantReference(advanceId: string): string {
  return `ADV-${advanceId}-${Date.now()}`;
}

/**
 * Formats a phone number to E.164 format (strips non-digits and leading zeros)
 * Defaulting to 254 (Kenya) if no country code provided
 */
export function formatPhoneNumber(phone: string, countryCode: string = '254'): string {
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 0, remove it and add country code
  if (cleaned.startsWith('0')) {
    cleaned = countryCode + cleaned.substring(1);
  }
  
  // If doesn't start with country code, add it
  if (!cleaned.startsWith(countryCode)) {
    cleaned = countryCode + cleaned;
  }
  
  return cleaned;
}

/**
 * Maps country codes to their default provider prefix
 */
export const COUNTRY_PROVIDER_PREFIXES: Record<string, string> = {
  'KE': '254',
  'UG': '256',
  'TZ': '255',
  'RW': '250',
};
