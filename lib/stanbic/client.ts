import { Redis } from '@upstash/redis';
import { getEnv } from '@/env';

/**
 * Stanbic Bank Integration Helper (Updated for Account Balance API)
 * - Uses correct sandbox token and balance endpoints
 * - Robust token caching in Upstash Redis
 */

const env = getEnv();

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

const TOKEN_CACHE_KEY = 'stanbic:access_token';

export function getStanbicBalanceUrl(): string {
  // The balance API has no path or query parameters — the account is resolved
  // server-side from the OAuth client credentials (client_id = subscription key).
  // Spec: GET / relative to basePath /api/sandbox/balance
  return (
    env.STANBIC_SANDBOX_URL_ENDPOINT ??
    env.STANBIC_SANDBOX_BASE_URL ??
    env.STANBIC_BASE_URL ??
    'https://sandbox.connect.stanbicbank.co.ke/api/sandbox/balance'
  ).replace(/([^/])$/, '$1/'); // ensure trailing slash to match the spec's GET /
}

export async function getCachedStanbicToken(): Promise<string | null> {
  try {
    const cached = await redis.get<string>(TOKEN_CACHE_KEY);
    if (cached) return cached;
  } catch (err) {
    console.error('[Stanbic Client] Redis GET error:', err instanceof Error ? err.message : String(err));
  }
  return null;
}

async function cacheStanbicToken(token: string, ttlSeconds: number) {
  try {
    await redis.set(TOKEN_CACHE_KEY, token, { ex: Math.max(60, Math.floor(ttlSeconds)) });
  } catch (err) {
    console.error('[Stanbic Client] Redis SET error:', err instanceof Error ? err.message : String(err));
  }
}

export async function fetchStanbicToken(): Promise<{ token: string; expiresIn: number }> {
  const tokenUrl = env.STANBIC_TOKEN_URL;
  if (!tokenUrl) throw new Error('STANBIC_TOKEN_URL not configured');

  const clientId = env.STANBIC_API_KEY ?? env.STANBIC_SANDBOX_API_KEY ?? '';
  const clientSecret = env.STANBIC_CLIENT_SECRET ?? '';

  if (!clientId || !clientSecret) {
    throw new Error('STANBIC_API_KEY / STANBIC_CLIENT_SECRET not configured');
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  
const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'payments',   // ← From your screenshot
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

export async function getStanbicToken(): Promise<string> {
  const cached = await getCachedStanbicToken();
  if (cached) return cached;

  const { token, expiresIn } = await fetchStanbicToken();

  const ttl = Math.max(60, expiresIn - 60);
  await cacheStanbicToken(token, ttl);

  return token;
}

export async function getStanbicAuthHeader(): Promise<Record<string, string>> {
  const tokenUrl = env.STANBIC_TOKEN_URL;
  // Azure API Management requires the subscription key on every request alongside
  // the OAuth Bearer token. Without it the gateway returns HTTP 200 with an empty body.
  const subscriptionKey = env.STANBIC_API_KEY ?? env.STANBIC_SANDBOX_API_KEY ?? '';

  if (tokenUrl) {
    try {
      const token = await getStanbicToken();
      console.log('[Stanbic Client] ✅ Using OAuth2 Bearer token');
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
    console.warn('[Stanbic Client] Using raw API key as Bearer');
    return {
      Authorization: `Bearer ${subscriptionKey}`,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
    };
  }

  throw new Error('No Stanbic authentication method configured');
}