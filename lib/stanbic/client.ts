import { Redis } from '@upstash/redis';
import { getEnv } from '@/env';

/**
 * Stanbic Bank Integration Client
 * - Environment-aware (sandbox | production) — mirrors lib/dusupay/client.ts pattern
 * - Per-env URLs and credentials with fallbacks to generic vars
 * - Robust token caching in Upstash Redis (scoped per environment)
 * - Production migration = env vars only, no code changes
 */

const env = getEnv();

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// ─── Type & Exports ───────────────────────────────────────────────────────────

export type StanbicEnvironment = 'sandbox' | 'production';
export type StanbicBalanceAccountMode = 'none' | 'path' | 'query' | 'body' | 'header';
export type StanbicBalanceHttpMethod = 'GET' | 'POST';

export interface StanbicBalanceAccountContext {
  accountNumber?: string | null;
  currency?: string | null;
  countryCode?: string | null;
}

export interface StanbicBalanceRequest {
  url: string;
  method: StanbicBalanceHttpMethod;
  headers: Record<string, string>;
  body?: string;
}

export class StanbicClient {
  private environment: StanbicEnvironment;
  private tokenCacheKey: string;
  private accountType: 'USD' | 'KES';

  constructor(accountType: 'USD' | 'KES' = 'USD') {
    this.environment = (process.env.STANBIC_ENVIRONMENT as StanbicEnvironment) === 'production'
      ? 'production'
      : 'sandbox';
    this.accountType = accountType;
    // Environment-scoped and account-scoped token cache key
    this.tokenCacheKey = `stanbic:access_token:${this.environment}:${this.accountType.toLowerCase()}`;
  }

  getEnvironment(): StanbicEnvironment {
    return this.environment;
  }

  private getTokenUrl(): string {
    const url = this.environment === 'production'
      ? env.STANBIC_PRODUCTION_TOKEN_URL ?? env.STANBIC_TOKEN_URL
      : env.STANBIC_SANDBOX_TOKEN_URL ?? env.STANBIC_TOKEN_URL;

    if (!url) {
      throw new Error(
        `STANBIC_TOKEN_URL not configured for environment: ${this.environment}`,
      );
    }
    return url;
  }

  private getSubscriptionKey(): string {
    if (this.accountType === 'KES') {
      return this.environment === 'production'
        ? env.STANBIC_PRODUCTION_KES_API_KEY ?? env.STANBIC_PRODUCTION_API_KEY ?? env.STANBIC_API_KEY ?? ''
        : env.STANBIC_SANDBOX_KES_API_KEY ?? env.STANBIC_SANDBOX_API_KEY ?? env.STANBIC_API_KEY ?? '';
    }
    return this.environment === 'production'
      ? env.STANBIC_PRODUCTION_API_KEY ?? env.STANBIC_API_KEY ?? ''
      : env.STANBIC_SANDBOX_API_KEY ?? env.STANBIC_API_KEY ?? '';
  }

  private getClientSecret(): string {
    if (this.accountType === 'KES') {
      return this.environment === 'production'
        ? env.STANBIC_PRODUCTION_KES_CLIENT_SECRET ?? env.STANBIC_PRODUCTION_CLIENT_SECRET ?? env.STANBIC_CLIENT_SECRET ?? ''
        : env.STANBIC_SANDBOX_KES_CLIENT_SECRET ?? env.STANBIC_SANDBOX_KES_CLIENT_SECRET ?? env.STANBIC_CLIENT_SECRET ?? '';
    }
    return this.environment === 'production'
      ? env.STANBIC_PRODUCTION_CLIENT_SECRET ?? env.STANBIC_CLIENT_SECRET ?? ''
      : env.STANBIC_SANDBOX_CLIENT_SECRET ?? env.STANBIC_CLIENT_SECRET ?? '';
  }

  getBalanceUrl(): string {
    const url = this.environment === 'production'
      ? env.STANBIC_PRODUCTION_URL_ENDPOINT ??
        env.STANBIC_PRODUCTION_BASE_URL ??
        env.STANBIC_BASE_URL
      : env.STANBIC_SANDBOX_URL_ENDPOINT ??
        env.STANBIC_SANDBOX_BASE_URL ??
        env.STANBIC_BASE_URL ??
        'https://sandbox.connect.stanbicbank.co.ke/api/sandbox/balance';

    if (!url) {
      throw new Error(
        'STANBIC_ENVIRONMENT=production but no production balance URL is configured (set STANBIC_PRODUCTION_BASE_URL)',
      );
    }

    // Only append trailing slash if the mode is 'path' to allow clean path parameter appending,
    // otherwise preserve the exact configured URL format.
    if (this.getBalanceAccountMode() === 'path') {
      return url.replace(/([^/])$/, '$1/');
    }
    return url;
  }

  getBalanceAccountMode(): StanbicBalanceAccountMode {
    const mode = env.STANBIC_BALANCE_ACCOUNT_MODE?.toLowerCase();
    if (mode === 'path' || mode === 'query' || mode === 'body' || mode === 'header') {
      return mode;
    }
    return 'none';
  }

  private getBalanceAccountParam(): string {
    return env.STANBIC_BALANCE_ACCOUNT_PARAM || 'accountNumber';
  }

  private getBalanceHttpMethod(): StanbicBalanceHttpMethod {
    return env.STANBIC_BALANCE_HTTP_METHOD?.toUpperCase() === 'POST' ? 'POST' : 'GET';
  }

  private buildAccountPathUrl(url: string, param: string, accountNumber: string): string {
    const encoded = encodeURIComponent(accountNumber);
    if (url.includes('{accountNumber}')) return url.replaceAll('{accountNumber}', encoded);
    if (url.includes('{accountId}')) return url.replaceAll('{accountId}', encoded);
    if (url.includes(`{${param}}`)) return url.replaceAll(`{${param}}`, encoded);

    throw new Error(
      'STANBIC_BALANCE_ACCOUNT_MODE=path requires STANBIC_*_URL_ENDPOINT to include {accountNumber}, {accountId}, or the configured parameter placeholder',
    );
  }

  async buildBalanceRequest(context: StanbicBalanceAccountContext = {}): Promise<StanbicBalanceRequest> {
    const mode = this.getBalanceAccountMode();
    const param = this.getBalanceAccountParam();
    const accountNumber = context.accountNumber?.trim();
    let method = this.getBalanceHttpMethod();
    let url = this.getBalanceUrl();
    const headers: Record<string, string> = {
      ...(await this.getAuthHeader()),
      Accept: 'application/json',
    };
    let body: string | undefined;

    if (mode !== 'none' && !accountNumber) {
      throw new Error(`Stanbic balance account selector is ${mode}, but the selected wallet has no account number`);
    }

    if (mode === 'path') {
      url = this.buildAccountPathUrl(url, param, accountNumber!);
    } else if (mode === 'query') {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.set(param, accountNumber!);
      url = parsedUrl.toString();
    } else if (mode === 'header') {
      headers[param] = accountNumber!;
    } else if (mode === 'body') {
      method = 'POST';
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({
        [param]: accountNumber,
        ...(context.currency ? { currency: context.currency.toUpperCase() } : {}),
        ...(context.countryCode ? { countryCode: context.countryCode.toUpperCase() } : {}),
      });
    }

    return { url, method, headers, body };
  }

  private async getCachedToken(): Promise<string | null> {
    try {
      const cached = await redis.get<string>(this.tokenCacheKey);
      if (cached) return cached;
    } catch (err) {
      console.error('[Stanbic Client] Redis GET error:', err instanceof Error ? err.message : String(err));
    }
    return null;
  }

  private async cacheToken(token: string, ttlSeconds: number): Promise<void> {
    try {
      await redis.set(this.tokenCacheKey, token, { ex: Math.max(60, Math.floor(ttlSeconds)) });
    } catch (err) {
      console.error('[Stanbic Client] Redis SET error:', err instanceof Error ? err.message : String(err));
    }
  }

  private async fetchToken(): Promise<{ token: string; expiresIn: number }> {
    const tokenUrl = this.getTokenUrl();
    const clientId = this.getSubscriptionKey();
    const clientSecret = this.getClientSecret();

    if (!clientId || !clientSecret) {
      throw new Error(
        `STANBIC credentials not configured for environment: ${this.environment}`,
      );
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'payments',
    });

    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => '(unreadable)');
      throw new Error(`Stanbic token endpoint returned ${resp.status}: ${bodyText}`);
    }

    const data = (await resp.json().catch(() => null)) as Record<string, unknown> | null;
    if (!data) throw new Error('Stanbic token endpoint returned invalid JSON');

    const token =
      typeof data.access_token === 'string' ? data.access_token
        : typeof data.token === 'string' ? data.token
        : typeof data.accessToken === 'string' ? data.accessToken
        : null;

    const expiresIn = Number(data.expires_in ?? data.expiresIn ?? 3600);

    if (!token) throw new Error('Stanbic token response did not include access_token');

    return { token, expiresIn: Number.isFinite(expiresIn) ? expiresIn : 3600 };
  }

  async getToken(): Promise<string> {
    const cached = await this.getCachedToken();
    if (cached) return cached;

    const { token, expiresIn } = await this.fetchToken();
    const ttl = Math.max(60, expiresIn - 60);
    await this.cacheToken(token, ttl);

    return token;
  }

  async fetchTokenForBackwardCompat(): Promise<{ token: string; expiresIn: number }> {
    return this.fetchToken();
  }

  async getAuthHeader(): Promise<Record<string, string>> {
    const subscriptionKey = this.getSubscriptionKey();
    const tokenUrl = this.environment === 'production'
      ? env.STANBIC_PRODUCTION_TOKEN_URL ?? env.STANBIC_TOKEN_URL
      : env.STANBIC_SANDBOX_TOKEN_URL ?? env.STANBIC_TOKEN_URL;

    // Azure API Management requires the subscription key on every request alongside OAuth token
    if (tokenUrl) {
      try {
        const token = await this.getToken();
        console.log(`[Stanbic Client] ✅ Using OAuth2 (${this.environment})`);
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        if (subscriptionKey) {
          headers['Ocp-Apim-Subscription-Key'] = subscriptionKey;
        }
        return headers;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Stanbic Client] ❌ Token retrieval failed:', msg);
        throw new Error(`Stanbic OAuth failed: ${msg}`);
      }
    }

    // Fallback to raw API key (rarely used)
    if (subscriptionKey) {
      console.warn(`[Stanbic Client] Using raw API key as Bearer (${this.environment})`);
      return {
        Authorization: `Bearer ${subscriptionKey}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      };
    }

    throw new Error('No Stanbic authentication method configured');
  }
}

// Single instances
export const stanbicClient = new StanbicClient('USD');
export const stanbicKesClient = new StanbicClient('KES');

export function getStanbicClientForCurrency(currency?: string | null): StanbicClient {
  if (currency?.toUpperCase() === 'KES') {
    return stanbicKesClient;
  }
  return stanbicClient;
}

// ─── Legacy backward-compatible helpers ────────────────────────────────────
// These delegate to stanbicClient for a smooth migration path

export function getStanbicEnvironment(): StanbicEnvironment {
  return stanbicClient.getEnvironment();
}

export async function getCachedStanbicToken(): Promise<string | null> {
  // Note: This is a public helper that doesn't exist on the class;
  // users should call stanbicClient.getToken() directly (which handles caching).
  // This function is kept for backward compatibility if it was exported before.
  return await stanbicClient.getToken();
}

export async function fetchStanbicToken(): Promise<{ token: string; expiresIn: number }> {
  // Kept for backward compatibility; calls the class method
  return stanbicClient.fetchTokenForBackwardCompat();
}

export async function getStanbicToken(): Promise<string> {
  return stanbicClient.getToken();
}

export function getStanbicBalanceUrl(): string {
  return stanbicClient.getBalanceUrl();
}

export async function getStanbicAuthHeader(): Promise<Record<string, string>> {
  return stanbicClient.getAuthHeader();
}

export function getStanbicBalanceAccountMode(): StanbicBalanceAccountMode {
  return stanbicClient.getBalanceAccountMode();
}

export async function buildStanbicBalanceRequest(
  context: StanbicBalanceAccountContext = {},
): Promise<StanbicBalanceRequest> {
  return stanbicClient.buildBalanceRequest(context);
}

export interface StanbicStatementRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export class StanbicStatementsClient {
  private environment: StanbicEnvironment;
  private tokenCacheKey: string;
  private currency: 'USD' | 'KES';

  constructor(currency: 'USD' | 'KES') {
    this.environment = (process.env.STANBIC_ENVIRONMENT as StanbicEnvironment) === 'production' ? 'production' : 'sandbox';
    this.currency = currency;
    this.tokenCacheKey = `stanbic:statement_access_token:${this.environment}:${this.currency.toLowerCase()}`;
  }

  getEnvironment(): StanbicEnvironment {
    return this.environment;
  }

  private getTokenUrl(): string {
    const url = this.environment === 'production'
      ? env.STANBIC_PRODUCTION_TOKEN_URL ?? env.STANBIC_TOKEN_URL
      : env.STANBIC_SANDBOX_TOKEN_URL ?? env.STANBIC_TOKEN_URL;
    if (!url) throw new Error(`STANBIC_TOKEN_URL not configured for environment: ${this.environment}`);
    return url;
  }

  private getSubscriptionKey(): string {
    if (this.currency === 'KES') {
      return this.environment === 'production'
        ? env.STANBIC_PRODUCTION_STATEMENT_FOR_KES_API_KEY ?? ''
        : env.STANBIC_SANDBOX_STATEMENT_FOR_KES_API_KEY ?? '';
    }
    return this.environment === 'production'
      ? env.STANBIC_PRODUCTION_STATEMENT_FOR_USD_API_KEY ?? ''
      : env.STANBIC_SANDBOX_STATEMENT_FOR_USD_API_KEY ?? '';
  }

  private getClientSecret(): string {
    if (this.currency === 'KES') {
      return this.environment === 'production'
        ? env.STANBIC_PRODUCTION_STATEMENT_FOR_KES_CLIENT_SECRET ?? ''
        : env.STANBIC_SANDBOX_STATEMENT_FOR_KES_CLIENT_SECRET ?? '';
    }
    return this.environment === 'production'
      ? env.STANBIC_PRODUCTION_STATEMENT_FOR_USD_CLIENT_SECRET ?? ''
      : env.STANBIC_SANDBOX_STATEMENT_FOR_USD_CLIENT_SECRET ?? '';
  }

  getStatementsUrl(): string {
    return this.environment === 'production'
      ? env.STANBIC_PRODUCTION_STATEMENT_URL_ENDPOINT ?? (() => { throw new Error('STANBIC_PRODUCTION_STATEMENT_URL_ENDPOINT not configured'); })()
      : env.STANBIC_SANDBOX_STATEMENT_URL_ENDPOINT ?? 'https://sandbox.connect.stanbicbank.co.ke/api/sandbox/fetchTransactions/';
  }

  private async getCachedToken(): Promise<string | null> {
    try {
      const cached = await redis.get<string>(this.tokenCacheKey);
      if (cached) return cached;
    } catch (err) {
      console.error('[Stanbic Statements Client] Redis GET error:', err instanceof Error ? err.message : String(err));
    }
    return null;
  }

  private async cacheToken(token: string, ttlSeconds: number): Promise<void> {
    try {
      await redis.set(this.tokenCacheKey, token, { ex: Math.max(60, Math.floor(ttlSeconds)) });
    } catch (err) {
      console.error('[Stanbic Statements Client] Redis SET error:', err instanceof Error ? err.message : String(err));
    }
  }

  private async fetchToken(): Promise<{ token: string; expiresIn: number }> {
    const tokenUrl = this.getTokenUrl();
    const clientId = this.getSubscriptionKey();
    const clientSecret = this.getClientSecret();
    if (!clientId || !clientSecret) {
      throw new Error(`Stanbic statement credentials not configured for environment=${this.environment} currency=${this.currency}`);
    }
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'payments',
    });
    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => '(unreadable)');
      throw new Error(`Stanbic statement token endpoint returned ${resp.status}: ${bodyText}`);
    }
    const data = (await resp.json().catch(() => null)) as Record<string, unknown> | null;
    if (!data) throw new Error('Stanbic statement token endpoint returned invalid JSON');
    const token = typeof data.access_token === 'string' ? data.access_token : null;
    const expiresIn = Number(data.expires_in ?? 3600);
    if (!token) throw new Error('Stanbic statement token response did not include access_token');
    return { token, expiresIn: Number.isFinite(expiresIn) ? expiresIn : 3600 };
  }

  async getToken(): Promise<string> {
    const cached = await this.getCachedToken();
    if (cached) return cached;
    const { token, expiresIn } = await this.fetchToken();
    await this.cacheToken(token, Math.max(60, expiresIn - 60));
    return token;
  }

  async buildStatementRequest(accountNumber: string): Promise<StanbicStatementRequest> {
    const token = await this.getToken();
    return {
      url: this.getStatementsUrl(),
      headers: {
        Authorization: `Bearer ${token}`,
        'Ocp-Apim-Subscription-Key': this.getSubscriptionKey(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ accountNumber }),
    };
  }
}

export const stanbicUsdStatementsClient = new StanbicStatementsClient('USD');
export const stanbicKesStatementsClient = new StanbicStatementsClient('KES');

export function getStanbicStatementsClientForCurrency(currency?: string | null): StanbicStatementsClient {
  return currency?.toUpperCase() === 'KES' ? stanbicKesStatementsClient : stanbicUsdStatementsClient;
}