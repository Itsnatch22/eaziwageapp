import dns from "dns";
import { promisify } from "util";

const resolveMx = promisify(dns.resolveMx);

/**
 * Email domain validation utilities
 */

// Broad set of known disposable / temporary email providers
const DISPOSABLE_DOMAINS = new Set([
  "tempmail.com",
  "10minutemail.com",
  "10minutemail.net",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "guerrillamailblock.com",
  "mailinator.com",
  "mailinator.net",
  "mailinator2.com",
  "throwaway.email",
  "temp-mail.org",
  "tempmailaddress.com",
  "tempmail.net",
  "tempmail.dev",
  "tempmail.plus",
  "maildrop.cc",
  "getnada.com",
  "trashmail.com",
  "trashmail.net",
  "trashmail.me",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "fakeinbox.com",
  "sharklasers.com",
  "spam4.me",
  "dispostable.com",
  "mintemail.com",
  "mytemp.email",
  "mohmal.com",
  "moakt.com",
  "emailondeck.com",
  "emailtemporanea.com",
  "throwawaymail.com",
  "tmpmail.org",
  "tmpmail.net",
  "tmpeml.com",
  "discard.email",
  "discardmail.com",
  "spambog.com",
  "spamgourmet.com",
  "33mail.com",
  "anonbox.net",
  "burnermail.io",
  "deadaddress.com",
  "fake-mail.net",
  "harakirimail.com",
  "inboxbear.com",
  "jetable.org",
  "luxusmail.org",
  "mailcatch.com",
  "mailnesia.com",
  "mailsac.com",
  "mt2014.com",
  "no-spam.ws",
  "noclickemail.com",
  "objectmail.com",
  "rcpt.at",
  "spambox.us",
  "spamfree24.org",
  "tempinbox.com",
  "tempmailo.com",
  "wegwerfmail.de",
  "wegwerfmail.net",
  "wegwerfmail.org",
  "einrot.com",
  "filzmail.com",
  "klzlk.com",
  "mailbox52.ml",
  "mailbox92.biz",
  "mail-temp.com",
  "tempr.email",
  "10mail.org",
  "20minutemail.com",
  "anonymbox.com",
  "armyspy.com",
  "cuvox.de",
  "dayrep.com",
  "einmalmail.de",
  "fleckens.hu",
  "gustr.com",
  "jourrapide.com",
  "rhyta.com",
  "superrito.com",
  "teleworm.us",
]);

// Common typos for popular email domains
const DOMAIN_CORRECTIONS: Record<string, string> = {
  // Gmail
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmil.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.com.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaiil.com": "gmail.com",
  "gmail.con": "gmail.com",
  "gmailcom": "gmail.com",
  "gmail.comm": "gmail.com",

  // Yahoo
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.cm": "yahoo.com",
  "yahho.com": "yahoo.com",
  "yhaoo.com": "yahoo.com",
  "yahoo.con": "yahoo.com",

  // Outlook
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outlook.co": "outlook.com",
  "outlook.cm": "outlook.com",
  "outllok.com": "outlook.com",
  "outlook.con": "outlook.com",

  // Hotmail
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmil.com": "hotmail.com",
  "hotmaill.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",

  // iCloud
  "iclud.com": "icloud.com",
  "icoud.com": "icloud.com",
  "icloud.co": "icloud.com",
  "iclould.com": "icloud.com",

  // Others
  "protonmai.com": "protonmail.com",
  "protomail.com": "protonmail.com",
  "live.co": "live.com",
};

export function isValidEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Checks if domain is a known disposable email service.
 * Also checks for known subdomain patterns used by disposable providers.
 */
export function isDisposableDomain(domain: string): boolean {
  const normalized = domain.toLowerCase();

  if (DISPOSABLE_DOMAINS.has(normalized)) {
    return true;
  }

  // Check if domain is a subdomain of a known disposable provider
  // e.g. "sub.mailinator.com" should match "mailinator.com"
  const parts = normalized.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join(".");
    if (DISPOSABLE_DOMAINS.has(parentDomain)) {
      return true;
    }
  }

  return false;
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
  } catch {
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