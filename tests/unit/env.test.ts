import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateEnv } from '../../env';

describe('validateEnv DusuPay checks', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    // Start from a minimal predictable env for server-side validation
    for (const k of Object.keys(process.env)) delete process.env[k];

    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'x'.repeat(24),
      NEXT_PUBLIC_RECAPTCHA_SITE_KEY: 'recap',

      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      RECAPTCHA_SECRET_KEY: 'recap-secret',
      UPSTASH_REDIS_REST_URL: 'http://redis.local',
      UPSTASH_REDIS_REST_TOKEN: 'redis-token',
      RESEND_API_KEY: 'resend-key',
      ADMIN_PASSWORD: 'admin-pass',
      CRON_SECRET: 'cron-secret',
      PII_ENCRYPTION_KEY: 'x'.repeat(16),

      STANBIC_SANDBOX_API_KEY: 'stanbic-sandbox',
      AT_SANDBOX_API_KEY: 'at-sandbox',

      // DusuPay base values (signing/key present), but webhook secret omitted in the test
      DUSUPAY_PUBLIC_KEY: 'dusu-public',
      DUSUPAY_SECRET_KEY: 'dusu-secret',
      DUSUPAY_ENVIRONMENT: 'sandbox',
      DUSUPAY_SIGNING_KEY: 'sign-key',
    });
  });

  afterEach(() => {
    // Restore original environment
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, savedEnv);
  });

  it('throws when DUSUPAY_WEBHOOK_SECRET is missing', () => {
    delete process.env.DUSUPAY_WEBHOOK_SECRET;
    expect(() => validateEnv()).toThrow(/DUSUPAY_WEBHOOK_SECRET/);
  });
});
