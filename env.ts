/**
 * Environment variable validation utility
 * Validates that all required environment variables are present and properly formatted
 */

interface EnvConfig {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: string;
  NEXT_PUBLIC_APP_URL?: string;
  
  SUPABASE_SERVICE_ROLE_KEY: string;
  RECAPTCHA_SECRET_KEY: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  RESEND_API_KEY: string;
  ADMIN_EMAILS?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_NOTIFICATION_EMAIL?: string;
  PUSH_VAPID_CONTACT?: string;
  VAPID_PUBLIC_KEY?: string;
  NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  SUPABASE_PRIVATE_VAPID_KEY?: string;

  // Stanbic API credentials and endpoints
  STANBIC_API_KEY?: string;
  STANBIC_CLIENT_SECRET?: string;
  STANBIC_SANDBOX_API_KEY?: string;
  STANBIC_SANDBOX_BASE_URL?: string;
  STANBIC_BASE_URL?: string;
  // New: optional explicit endpoint and token URL used by Stanbic integrations
  STANBIC_SANDBOX_URL_ENDPOINT?: string;
  STANBIC_TOKEN_URL?: string;
}

class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentError';
  }
}

/**
 * Validates environment variables on server startup
 * @throws {EnvironmentError} if any required variables are missing or invalid
 */
export function validateEnv(): EnvConfig {
  const errors: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is not defined');
  } else if (!isValidUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is not a valid URL');
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined');
  } else if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length < 20) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY looks too short to be valid');
  }

  if (!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    errors.push('NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not defined');
  }

  if (typeof window === 'undefined') {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      errors.push('SUPABASE_SERVICE_ROLE_KEY is not defined');
    }

    if (!process.env.RECAPTCHA_SECRET_KEY) {
      errors.push('RECAPTCHA_SECRET_KEY is not defined');
    }

    if (!process.env.UPSTASH_REDIS_REST_URL) {
      errors.push('UPSTASH_REDIS_REST_URL is not defined');
    } else if (!isValidUrl(process.env.UPSTASH_REDIS_REST_URL)) {
      errors.push('UPSTASH_REDIS_REST_URL is not a valid URL');
    }

    if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
      errors.push('UPSTASH_REDIS_REST_TOKEN is not defined');
    }

    if (!process.env.ADMIN_EMAILS) {
      errors.push('ADMIN_EMAILS is not defined');
    } else {
      const emails = process.env.ADMIN_EMAILS.split(',').map(e => e.trim());
      if (emails.some(e => !e || !/\S+@\S+\.\S+/.test(e))) {
        errors.push('ADMIN_EMAILS contains invalid email addresses');
      }
    }

    if (process.env.ADMIN_NOTIFICATION_EMAIL && !/\S+@\S+\.\S+/.test(process.env.ADMIN_NOTIFICATION_EMAIL)) {
      errors.push('ADMIN_NOTIFICATION_EMAIL is not a valid email address');
    }

    if (!process.env.ADMIN_PASSWORD) {
      errors.push('ADMIN_PASSWORD is not defined');
    }

    if (!process.env.RESEND_API_KEY) {
      errors.push('RESEND_API_KEY is not defined');
    }

    // Stanbic: require at least one API key (production or sandbox)
    if (!process.env.STANBIC_API_KEY && !process.env.STANBIC_SANDBOX_API_KEY) {
      errors.push('STANBIC_API_KEY or STANBIC_SANDBOX_API_KEY is not defined');
    }

    // Stanbic: client secret required for OAuth client_credentials token requests
    if (process.env.STANBIC_TOKEN_URL && !process.env.STANBIC_CLIENT_SECRET) {
      errors.push('STANBIC_CLIENT_SECRET is not defined (required when STANBIC_TOKEN_URL is set)');
    }

    if (process.env.STANBIC_SANDBOX_BASE_URL && !isValidUrl(process.env.STANBIC_SANDBOX_BASE_URL)) {
      errors.push('STANBIC_SANDBOX_BASE_URL is not a valid URL');
    }

    if (process.env.STANBIC_BASE_URL && !isValidUrl(process.env.STANBIC_BASE_URL)) {
      errors.push('STANBIC_BASE_URL is not a valid URL');
    }

    // Optional Stanbic endpoint and token URL
    if (process.env.STANBIC_SANDBOX_URL_ENDPOINT && !isValidUrl(process.env.STANBIC_SANDBOX_URL_ENDPOINT)) {
      errors.push('STANBIC_SANDBOX_URL_ENDPOINT is not a valid URL');
    }

    if (process.env.STANBIC_TOKEN_URL && !isValidUrl(process.env.STANBIC_TOKEN_URL)) {
      errors.push('STANBIC_TOKEN_URL is not a valid URL');
    }
  }

  if (errors.length > 0) {
    throw new EnvironmentError(
      `Environment validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`
    );
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY!,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL!,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN!,
    RESEND_API_KEY: process.env.RESEND_API_KEY!,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    ADMIN_NOTIFICATION_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    PUSH_VAPID_CONTACT: process.env.PUSH_VAPID_CONTACT,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    SUPABASE_PRIVATE_VAPID_KEY: process.env.SUPABASE_PRIVATE_VAPID_KEY,

    // Stanbic
    STANBIC_API_KEY: process.env.STANBIC_API_KEY,
    STANBIC_CLIENT_SECRET: process.env.STANBIC_CLIENT_SECRET,
    STANBIC_SANDBOX_API_KEY: process.env.STANBIC_SANDBOX_API_KEY,
    STANBIC_SANDBOX_BASE_URL: process.env.STANBIC_SANDBOX_BASE_URL,
    STANBIC_BASE_URL: process.env.STANBIC_BASE_URL,
    // New endpoints (optional)
    STANBIC_SANDBOX_URL_ENDPOINT: process.env.STANBIC_SANDBOX_URL_ENDPOINT,
    STANBIC_TOKEN_URL: process.env.STANBIC_TOKEN_URL,
  };
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

let cachedEnv: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}