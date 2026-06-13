/**
 * Environment variable validation utility
 * Validates that all required environment variables are present and properly formatted
 */

interface EnvConfig {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: string;
  NEXT_PUBLIC_APP_URL?: string;
  NEXT_PUBLIC_PUSHER_APP_KEY: string;
  NEXT_PUBLIC_PUSHER_CLUSTER: string;
  
  SUPABASE_SERVICE_ROLE_KEY: string;
  RECAPTCHA_SECRET_KEY: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  RESEND_API_KEY: string;
  ADMIN_EMAILS?: string;
  ADMIN_PASSWORD?: string;
  PUSHER_APP_ID: string;
  PUSHER_APP_SECRET: string;
  PUSH_VAPID_CONTACT?: string;
  VAPID_PUBLIC_KEY?: string;
  NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  SUPABASE_PRIVATE_VAPID_KEY?: string;
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

  if (!process.env.NEXT_PUBLIC_PUSHER_APP_KEY) {
    errors.push('NEXT_PUBLIC_PUSHER_APP_KEY is not defined');
  }

  if (!process.env.NEXT_PUBLIC_PUSHER_CLUSTER) {
    errors.push('NEXT_PUBLIC_PUSHER_CLUSTER is not defined');
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

    if (!process.env.ADMIN_PASSWORD) {
      errors.push('ADMIN_PASSWORD is not defined');
    }

    if (!process.env.RESEND_API_KEY) {
      errors.push('RESEND_API_KEY is not defined');
    }

    if (!process.env.PUSHER_APP_ID) {
      errors.push('PUSHER_APP_ID is not defined');
    }

    if (!process.env.PUSHER_APP_SECRET) {
      errors.push('PUSHER_APP_SECRET is not defined');
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
    NEXT_PUBLIC_PUSHER_APP_KEY: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
    NEXT_PUBLIC_PUSHER_CLUSTER: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY!,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL!,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN!,
    RESEND_API_KEY: process.env.RESEND_API_KEY!,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    PUSHER_APP_ID: process.env.PUSHER_APP_ID!,
    PUSHER_APP_SECRET: process.env.PUSHER_APP_SECRET!,
    PUSH_VAPID_CONTACT: process.env.PUSH_VAPID_CONTACT,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    SUPABASE_PRIVATE_VAPID_KEY: process.env.SUPABASE_PRIVATE_VAPID_KEY,
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