export function generateMerchantReference(advanceId: string): string {
  return `ADV-${advanceId}-${Date.now()}`;
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
