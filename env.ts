export {}; 
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
  PII_ENCRYPTION_KEY: string;
  ADMIN_PASSWORD?: string;
  ADMIN_NOTIFICATION_EMAIL?: string;
  PUSH_VAPID_CONTACT?: string;
  VAPID_PUBLIC_KEY?: string;
  NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  SUPABASE_PRIVATE_VAPID_KEY?: string;
  CRON_SECRET?: string;

  DUSUPAY_ENVIRONMENT?: string;
  DUSUPAY_PUBLIC_KEY?: string;
  DUSUPAY_SECRET_KEY?: string;
  DUSUPAY_WEBHOOK_SECRET?: string;
  DUSUPAY_SIGNING_KEY?: string;
  DUSUPAY_WEBHOOK_URL?: string;
  DUSUPAY_SANDBOX_BASE_URL?: string;
  DUSUPAY_PRODUCTION_BASE_URL?: string;
  DUSUPAY_ALLOWED_IPS?: string;
  DUSUPAY_INCLUDE_EMPTY_SECRET?: string;

  STANBIC_ENVIRONMENT?: string;
  STANBIC_API_KEY?: string;
  STANBIC_CLIENT_SECRET?: string;
  STANBIC_SANDBOX_API_KEY?: string;
  STANBIC_SANDBOX_CLIENT_SECRET?: string;
  STANBIC_SANDBOX_KES_API_KEY?: string;
  STANBIC_SANDBOX_KES_CLIENT_SECRET?: string;
  STANBIC_SANDBOX_BASE_URL?: string;
  STANBIC_SANDBOX_URL_ENDPOINT?: string;
  STANBIC_SANDBOX_TOKEN_URL?: string;
  STANBIC_PRODUCTION_API_KEY?: string;
  STANBIC_PRODUCTION_CLIENT_SECRET?: string;
  STANBIC_PRODUCTION_KES_API_KEY?: string;
  STANBIC_PRODUCTION_KES_CLIENT_SECRET?: string;
  STANBIC_PRODUCTION_BASE_URL?: string;
  STANBIC_PRODUCTION_URL_ENDPOINT?: string;
  STANBIC_PRODUCTION_TOKEN_URL?: string;
  STANBIC_BASE_URL?: string;
  STANBIC_TOKEN_URL?: string;
  STANBIC_BALANCE_ACCOUNT_MODE?: string;
  STANBIC_BALANCE_ACCOUNT_PARAM?: string;
  STANBIC_BALANCE_HTTP_METHOD?: string;

  AT_ENVIRONMENT?: string;
  AT_API_KEY?: string;
  AT_USERNAME?: string;
  AT_SANDBOX_API_KEY?: string;
  AT_SANDBOX_USERNAME?: string;
  AT_PRODUCTION_API_KEY?: string;
  AT_PRODUCTION_USERNAME?: string;
  AT_SENDER_ID?: string;

  STANBIC_SANDBOX_STATEMENT_FOR_KES_API_KEY?: string;
  STANBIC_SANDBOX_STATEMENT_FOR_KES_CLIENT_SECRET?: string;
  STANBIC_PRODUCTION_STATEMENT_FOR_KES_API_KEY?: string;
  STANBIC_PRODUCTION_STATEMENT_FOR_KES_CLIENT_SECRET?: string;
  STANBIC_SANDBOX_STATEMENT_FOR_USD_API_KEY?: string;
  STANBIC_SANDBOX_STATEMENT_FOR_USD_CLIENT_SECRET?: string;
  STANBIC_PRODUCTION_STATEMENT_FOR_USD_API_KEY?: string;
  STANBIC_PRODUCTION_STATEMENT_FOR_USD_CLIENT_SECRET?: string;
  STANBIC_SANDBOX_STATEMENT_URL_ENDPOINT?: string;
  STANBIC_PRODUCTION_STATEMENT_URL_ENDPOINT?: string;
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

    if (process.env.ADMIN_NOTIFICATION_EMAIL && !/\S+@\S+\.\S+/.test(process.env.ADMIN_NOTIFICATION_EMAIL)) {
      errors.push('ADMIN_NOTIFICATION_EMAIL is not a valid email address');
    }

    if (!process.env.ADMIN_PASSWORD) {
      errors.push('ADMIN_PASSWORD is not defined');
    }

    if (!process.env.CRON_SECRET) {
      errors.push('CRON_SECRET is not defined');
    }

    if (!process.env.RESEND_API_KEY) {
      errors.push('RESEND_API_KEY is not defined');
    }

    if (!process.env.PII_ENCRYPTION_KEY) {
      errors.push('PII_ENCRYPTION_KEY is not defined');
    } else if (process.env.PII_ENCRYPTION_KEY.length < 16) {
      errors.push('PII_ENCRYPTION_KEY is too short (minimum 16 characters)');
    }

    if (!process.env.STANBIC_API_KEY && !process.env.STANBIC_SANDBOX_API_KEY) {
      errors.push('STANBIC_API_KEY or STANBIC_SANDBOX_API_KEY is not defined');
    }

    if (process.env.STANBIC_TOKEN_URL && !process.env.STANBIC_CLIENT_SECRET) {
      errors.push('STANBIC_CLIENT_SECRET is not defined (required when STANBIC_TOKEN_URL is set)');
    }

    if (process.env.STANBIC_SANDBOX_BASE_URL && !isValidUrl(process.env.STANBIC_SANDBOX_BASE_URL)) {
      errors.push('STANBIC_SANDBOX_BASE_URL is not a valid URL');
    }

    if (process.env.STANBIC_BASE_URL && !isValidUrl(process.env.STANBIC_BASE_URL)) {
      errors.push('STANBIC_BASE_URL is not a valid URL');
    }

    if (process.env.STANBIC_SANDBOX_URL_ENDPOINT && !isValidUrl(process.env.STANBIC_SANDBOX_URL_ENDPOINT)) {
      errors.push('STANBIC_SANDBOX_URL_ENDPOINT is not a valid URL');
    }

    if (process.env.STANBIC_TOKEN_URL && !isValidUrl(process.env.STANBIC_TOKEN_URL)) {
      errors.push('STANBIC_TOKEN_URL is not a valid URL');
    }

    if (process.env.STANBIC_PRODUCTION_TOKEN_URL && !isValidUrl(process.env.STANBIC_PRODUCTION_TOKEN_URL)) {
      errors.push('STANBIC_PRODUCTION_TOKEN_URL is not a valid URL');
    }

    if (process.env.STANBIC_PRODUCTION_BASE_URL && !isValidUrl(process.env.STANBIC_PRODUCTION_BASE_URL)) {
      errors.push('STANBIC_PRODUCTION_BASE_URL is not a valid URL');
    }

    if (process.env.STANBIC_PRODUCTION_URL_ENDPOINT && !isValidUrl(process.env.STANBIC_PRODUCTION_URL_ENDPOINT)) {
      errors.push('STANBIC_PRODUCTION_URL_ENDPOINT is not a valid URL');
    }

    if (
      process.env.STANBIC_BALANCE_ACCOUNT_MODE
      && !['none', 'path', 'query', 'body', 'header'].includes(process.env.STANBIC_BALANCE_ACCOUNT_MODE.toLowerCase())
    ) {
      errors.push('STANBIC_BALANCE_ACCOUNT_MODE must be one of: none, path, query, body, header');
    }

    if (
      process.env.STANBIC_BALANCE_HTTP_METHOD
      && !['GET', 'POST'].includes(process.env.STANBIC_BALANCE_HTTP_METHOD.toUpperCase())
    ) {
      errors.push('STANBIC_BALANCE_HTTP_METHOD must be GET or POST');
    }

    // DusuPay config
    if (!process.env.DUSUPAY_PUBLIC_KEY) {
      errors.push('DUSUPAY_PUBLIC_KEY is not defined');
    }
    if (process.env.DUSUPAY_ENVIRONMENT === 'production' && !process.env.DUSUPAY_SECRET_KEY) {
      errors.push('DUSUPAY_SECRET_KEY is not defined for production environment');
    }
    if (!process.env.DUSUPAY_WEBHOOK_SECRET) {
      errors.push('DUSUPAY_WEBHOOK_SECRET is not defined (required to verify webhooks)');
    }
    if (!process.env.DUSUPAY_SIGNING_KEY) {
      errors.push('DUSUPAY_SIGNING_KEY is not defined');
    }
    if (process.env.DUSUPAY_WEBHOOK_URL && !isValidUrl(process.env.DUSUPAY_WEBHOOK_URL)) {
      errors.push('DUSUPAY_WEBHOOK_URL is not a valid URL');
    }
    if (process.env.DUSUPAY_SANDBOX_BASE_URL && !isValidUrl(process.env.DUSUPAY_SANDBOX_BASE_URL)) {
      errors.push('DUSUPAY_SANDBOX_BASE_URL is not a valid URL');
    }
    if (process.env.DUSUPAY_PRODUCTION_BASE_URL && !isValidUrl(process.env.DUSUPAY_PRODUCTION_BASE_URL)) {
      errors.push('DUSUPAY_PRODUCTION_BASE_URL is not a valid URL');
    }
    if (process.env.DUSUPAY_ALLOWED_IPS && process.env.DUSUPAY_ALLOWED_IPS.split(',').some(ip => !ip.trim())) {
      errors.push('DUSUPAY_ALLOWED_IPS must be a comma-separated list of IPs if set');
    }

    if (process.env.AT_ENVIRONMENT === 'production') {
      if (!process.env.AT_PRODUCTION_API_KEY && !process.env.AT_API_KEY) {
        errors.push('AT_PRODUCTION_API_KEY or AT_API_KEY is not defined (required when AT_ENVIRONMENT=production)');
      }
      if (!process.env.AT_PRODUCTION_USERNAME && !process.env.AT_USERNAME) {
        errors.push('AT_PRODUCTION_USERNAME or AT_USERNAME is not defined (required when AT_ENVIRONMENT=production)');
      }
    } else {
      if (!process.env.AT_SANDBOX_API_KEY && !process.env.AT_API_KEY) {
        errors.push('AT_SANDBOX_API_KEY or AT_API_KEY is not defined (required for Africa\'s Talking sandbox)');
      }
      if (!process.env.AT_SANDBOX_USERNAME && !process.env.AT_USERNAME) {
        errors.push('AT_SANDBOX_USERNAME or AT_USERNAME is not defined (required for Africa\'s Talking sandbox)');
      }
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
    PII_ENCRYPTION_KEY: process.env.PII_ENCRYPTION_KEY!,
    ADMIN_NOTIFICATION_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    PUSH_VAPID_CONTACT: process.env.PUSH_VAPID_CONTACT,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    SUPABASE_PRIVATE_VAPID_KEY: process.env.SUPABASE_PRIVATE_VAPID_KEY,


    STANBIC_ENVIRONMENT: process.env.STANBIC_ENVIRONMENT,
    STANBIC_API_KEY: process.env.STANBIC_API_KEY,
    STANBIC_CLIENT_SECRET: process.env.STANBIC_CLIENT_SECRET,
    STANBIC_SANDBOX_API_KEY: process.env.STANBIC_SANDBOX_API_KEY,
    STANBIC_SANDBOX_CLIENT_SECRET: process.env.STANBIC_SANDBOX_CLIENT_SECRET,
    STANBIC_SANDBOX_KES_API_KEY: process.env.STANBIC_SANDBOX_KES_API_KEY,
    STANBIC_SANDBOX_KES_CLIENT_SECRET: process.env.STANBIC_SANDBOX_KES_CLIENT_SECRET,
    STANBIC_SANDBOX_BASE_URL: process.env.STANBIC_SANDBOX_BASE_URL,
    STANBIC_SANDBOX_URL_ENDPOINT: process.env.STANBIC_SANDBOX_URL_ENDPOINT,
    STANBIC_SANDBOX_TOKEN_URL: process.env.STANBIC_SANDBOX_TOKEN_URL,
    STANBIC_PRODUCTION_API_KEY: process.env.STANBIC_PRODUCTION_API_KEY,
    STANBIC_PRODUCTION_CLIENT_SECRET: process.env.STANBIC_PRODUCTION_CLIENT_SECRET,
    STANBIC_PRODUCTION_KES_API_KEY: process.env.STANBIC_PRODUCTION_KES_API_KEY,
    STANBIC_PRODUCTION_KES_CLIENT_SECRET: process.env.STANBIC_PRODUCTION_KES_CLIENT_SECRET,
    STANBIC_PRODUCTION_BASE_URL: process.env.STANBIC_PRODUCTION_BASE_URL,
    STANBIC_PRODUCTION_URL_ENDPOINT: process.env.STANBIC_PRODUCTION_URL_ENDPOINT,
    STANBIC_PRODUCTION_TOKEN_URL: process.env.STANBIC_PRODUCTION_TOKEN_URL,
    STANBIC_BASE_URL: process.env.STANBIC_BASE_URL,
    STANBIC_TOKEN_URL: process.env.STANBIC_TOKEN_URL,
    STANBIC_BALANCE_ACCOUNT_MODE: process.env.STANBIC_BALANCE_ACCOUNT_MODE,
    STANBIC_BALANCE_ACCOUNT_PARAM: process.env.STANBIC_BALANCE_ACCOUNT_PARAM,
    STANBIC_BALANCE_HTTP_METHOD: process.env.STANBIC_BALANCE_HTTP_METHOD,
    CRON_SECRET: process.env.CRON_SECRET,
    DUSUPAY_ENVIRONMENT: process.env.DUSUPAY_ENVIRONMENT,
    DUSUPAY_PUBLIC_KEY: process.env.DUSUPAY_PUBLIC_KEY,
    DUSUPAY_SECRET_KEY: process.env.DUSUPAY_SECRET_KEY,
    DUSUPAY_WEBHOOK_SECRET: process.env.DUSUPAY_WEBHOOK_SECRET,
    DUSUPAY_SIGNING_KEY: process.env.DUSUPAY_SIGNING_KEY,
    DUSUPAY_WEBHOOK_URL: process.env.DUSUPAY_WEBHOOK_URL,
    DUSUPAY_SANDBOX_BASE_URL: process.env.DUSUPAY_SANDBOX_BASE_URL,
    DUSUPAY_PRODUCTION_BASE_URL: process.env.DUSUPAY_PRODUCTION_BASE_URL,
    DUSUPAY_ALLOWED_IPS: process.env.DUSUPAY_ALLOWED_IPS,
    DUSUPAY_INCLUDE_EMPTY_SECRET: process.env.DUSUPAY_INCLUDE_EMPTY_SECRET,

    AT_ENVIRONMENT: process.env.AT_ENVIRONMENT,
    AT_API_KEY: process.env.AT_API_KEY,
    AT_USERNAME: process.env.AT_USERNAME,
    AT_SANDBOX_API_KEY: process.env.AT_SANDBOX_API_KEY,
    AT_SANDBOX_USERNAME: process.env.AT_SANDBOX_USERNAME,
    AT_PRODUCTION_API_KEY: process.env.AT_PRODUCTION_API_KEY,
    AT_PRODUCTION_USERNAME: process.env.AT_PRODUCTION_USERNAME,
    AT_SENDER_ID: process.env.AT_SENDER_ID,

    STANBIC_SANDBOX_STATEMENT_FOR_KES_API_KEY: process.env.STANBIC_SANDBOX_STATEMENT_FOR_KES_API_KEY,
    STANBIC_SANDBOX_STATEMENT_FOR_KES_CLIENT_SECRET: process.env.STANBIC_SANDBOX_STATEMENT_FOR_KES_CLIENT_SECRET,
    STANBIC_PRODUCTION_STATEMENT_FOR_KES_API_KEY: process.env.STANBIC_PRODUCTION_STATEMENT_FOR_KES_API_KEY,
    STANBIC_PRODUCTION_STATEMENT_FOR_KES_CLIENT_SECRET: process.env.STANBIC_PRODUCTION_STATEMENT_FOR_KES_CLIENT_SECRET,
    STANBIC_SANDBOX_STATEMENT_FOR_USD_API_KEY: process.env.STANBIC_SANDBOX_STATEMENT_FOR_USD_API_KEY,
    STANBIC_SANDBOX_STATEMENT_FOR_USD_CLIENT_SECRET: process.env.STANBIC_SANDBOX_STATEMENT_FOR_USD_CLIENT_SECRET,
    STANBIC_PRODUCTION_STATEMENT_FOR_USD_API_KEY: process.env.STANBIC_PRODUCTION_STATEMENT_FOR_USD_API_KEY,
    STANBIC_PRODUCTION_STATEMENT_FOR_USD_CLIENT_SECRET: process.env.STANBIC_PRODUCTION_STATEMENT_FOR_USD_CLIENT_SECRET,
    STANBIC_SANDBOX_STATEMENT_URL_ENDPOINT: process.env.STANBIC_SANDBOX_STATEMENT_URL_ENDPOINT,
    STANBIC_PRODUCTION_STATEMENT_URL_ENDPOINT: process.env.STANBIC_PRODUCTION_STATEMENT_URL_ENDPOINT,
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
