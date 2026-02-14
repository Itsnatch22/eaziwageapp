/**
 * Environment variable validation utility
 * Validates that all required environment variables are present and properly formatted
 */

interface EnvConfig {
  // Public (client-side) variables
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: string;
  NEXT_PUBLIC_APP_URL?: string;
  
  // Server-side only variables
  SUPABASE_SERVICE_ROLE_KEY: string;
  RECAPTCHA_SECRET_KEY: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  RESEND_API_KEY: string;
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

  // Check public variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is not defined');
  } else if (!isValidUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is not a valid URL');
  }

  if (!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    errors.push('NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not defined');
  }

  // Check server-side variables (only on server)
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

    if (!process.env.RESEND_API_KEY) {
      errors.push('RESEND_API_KEY is not defined');
    }
  }

  if (errors.length > 0) {
    throw new EnvironmentError(
      `Environment validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`
    );
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY!,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL!,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN!,
    RESEND_API_KEY: process.env.RESEND_API_KEY!,
  };
}

/**
 * Validates URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get validated environment config
 * Caches the result after first validation
 */
let cachedEnv: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}