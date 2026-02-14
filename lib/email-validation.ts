import dns from "dns";
import { promisify } from "util";

const resolveMx = promisify(dns.resolveMx);

/**
 * Email domain validation utilities
 */

// Common disposable/temporary email domains to block
const DISPOSABLE_DOMAINS = new Set([
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "throwaway.email",
  "temp-mail.org",
  "maildrop.cc",
  "getnada.com",
  "trashmail.com",
]);

// Common typos for popular email domains
const DOMAIN_CORRECTIONS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmil.com": "gmail.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "hotmial.com": "hotmail.com",
};

/**
 * Validates email format
 */
export function isValidEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Checks if domain is a known disposable email service
 */
export function isDisposableDomain(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}

/**
 * Suggests correction for common email typos
 */
export function suggestDomainCorrection(domain: string): string | null {
  return DOMAIN_CORRECTIONS[domain.toLowerCase()] || null;
}

/**
 * Validates domain format (without DNS check)
 */
export function isValidDomainFormat(domain: string): boolean {
  // Domain must have at least one dot and valid characters
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.([a-zA-Z]{2,}\.?)+$/;
  return domainRegex.test(domain);
}

/**
 * Verifies domain has valid MX records (DNS check)
 * This is an async operation and should be used carefully
 * @param domain - Email domain to check
 * @returns true if domain has valid MX records
 */
export async function hasMxRecords(domain: string): Promise<boolean> {
  try {
    const addresses = await resolveMx(domain);
    return addresses && addresses.length > 0;
  } catch (err) {
    // DNS lookup failed - domain doesn't exist or no MX records
    return false;
  }
}

/**
 * Comprehensive email validation
 * @param email - Email address to validate
 * @param checkDns - Whether to perform DNS MX record check (slower)
 * @returns Validation result with suggestions
 */
export async function validateEmail(
  email: string,
  checkDns: boolean = false
): Promise<{
  valid: boolean;
  error?: string;
  suggestion?: string;
}> {
  // Format check
  if (!isValidEmailFormat(email)) {
    return {
      valid: false,
      error: "Invalid email format",
    };
  }

  const domain = email.split("@")[1].toLowerCase();

  // Domain format check
  if (!isValidDomainFormat(domain)) {
    return {
      valid: false,
      error: "Invalid email domain format",
    };
  }

  // Disposable email check
  if (isDisposableDomain(domain)) {
    return {
      valid: false,
      error: "Temporary/disposable email addresses are not allowed",
    };
  }

  // Typo suggestion
  const suggestion = suggestDomainCorrection(domain);
  if (suggestion) {
    const correctedEmail = email.replace(domain, suggestion);
    return {
      valid: false,
      error: "Possible typo in email domain",
      suggestion: `Did you mean ${correctedEmail}?`,
    };
  }

  // DNS MX record check (optional, slower)
  if (checkDns) {
    const hasValidMx = await hasMxRecords(domain);
    if (!hasValidMx) {
      return {
        valid: false,
        error: "Email domain does not exist or cannot receive emails",
      };
    }
  }

  return { valid: true };
}

/**
 * Quick synchronous email validation (no DNS check)
 * Use this for client-side or when you need fast validation
 */
export function validateEmailSync(email: string): {
  valid: boolean;
  error?: string;
  suggestion?: string;
} {
  if (!isValidEmailFormat(email)) {
    return {
      valid: false,
      error: "Invalid email format",
    };
  }

  const domain = email.split("@")[1].toLowerCase();

  if (!isValidDomainFormat(domain)) {
    return {
      valid: false,
      error: "Invalid email domain format",
    };
  }

  if (isDisposableDomain(domain)) {
    return {
      valid: false,
      error: "Temporary/disposable email addresses are not allowed",
    };
  }

  const suggestion = suggestDomainCorrection(domain);
  if (suggestion) {
    const correctedEmail = email.replace(domain, suggestion);
    return {
      valid: false,
      error: "Possible typo in email domain",
      suggestion: `Did you mean ${correctedEmail}?`,
    };
  }

  return { valid: true };
}