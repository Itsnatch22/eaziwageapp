/**
 * Phone number validation for East African countries
 * Supports Kenya, Uganda, Tanzania, and Rwanda
 */

export interface CountryCode {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
  placeholder: string;
  pattern: RegExp;
  format: (phone: string) => string;
}

export const COUNTRY_CODES: Record<string, CountryCode> = {
  KE: {
    code: "KE",
    dialCode: "+254",
    flag: "🇰🇪",
    name: "Kenya",
    placeholder: "712 345 678",
    pattern: /^(7|1)\d{8}$/,
    format: (phone: string) => {
      const cleaned = phone.replace(/\D/g, "");
      if (cleaned.length === 9) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
      }
      return phone;
    },
  },
  UG: {
    code: "UG",
    dialCode: "+256",
    flag: "🇺🇬",
    name: "Uganda",
    placeholder: "712 345 678",
    pattern: /^(7|3)\d{8}$/,
    format: (phone: string) => {
      const cleaned = phone.replace(/\D/g, "");
      if (cleaned.length === 9) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
      }
      return phone;
    },
  },
  TZ: {
    code: "TZ",
    dialCode: "+255",
    flag: "🇹🇿",
    name: "Tanzania",
    placeholder: "712 345 678",
    pattern: /^(6|7)\d{8}$/,
    format: (phone: string) => {
      const cleaned = phone.replace(/\D/g, "");
      if (cleaned.length === 9) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
      }
      return phone;
    },
  },
  RW: {
    code: "RW",
    dialCode: "+250",
    flag: "🇷🇼",
    name: "Rwanda",
    placeholder: "712 345 678",
    pattern: /^(7|2)\d{8}$/,
    format: (phone: string) => {
      const cleaned = phone.replace(/\D/g, "");
      if (cleaned.length === 9) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
      }
      return phone;
    },
  },
};

/**
 * Validates phone number for a specific country
 */
export function validatePhone(
  phone: string,
  countryCode: string
): { valid: boolean; error?: string; formatted?: string } {
  const country = COUNTRY_CODES[countryCode];
  if (!country) {
    return { valid: false, error: "Invalid country code" };
  }

  const cleaned = phone.replace(/\D/g, "");
  
  if (!cleaned) {
    return { valid: false, error: "Phone number is required" };
  }

  if (!country.pattern.test(cleaned)) {
    return {
      valid: false,
      error: `Invalid ${country.name} phone number format`,
    };
  }

  return {
    valid: true,
    formatted: country.format(cleaned),
  };
}

/**
 * Format phone number with country code
 */
export function formatPhoneWithCountryCode(
  phone: string,
  countryCode: string
): string {
  const country = COUNTRY_CODES[countryCode];
  if (!country) return phone;

  const cleaned = phone.replace(/\D/g, "");
  return `${country.dialCode}${cleaned}`;
}

/**
 * Parse phone number to extract country code and local number
 */
export function parsePhoneNumber(fullPhone: string): {
  countryCode: string | null;
  localNumber: string;
} {
  for (const [code, country] of Object.entries(COUNTRY_CODES)) {
    if (fullPhone.startsWith(country.dialCode)) {
      return {
        countryCode: code,
        localNumber: fullPhone.substring(country.dialCode.length),
      };
    }
  }

  return {
    countryCode: null,
    localNumber: fullPhone,
  };
}