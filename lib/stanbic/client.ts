import { Redis } from '@upstash/redis';
import { getEnv } from '@/env';

/**
 * Lightweight Stanbic integration helper
 * - fetches OAuth/token from STANBIC_TOKEN_URL (if configured)
 * - caches token in Upstash Redis (using UPSTASH_REDIS_REST_URL/TOKEN)
 * - exposes helper to build Stanbic base URL
 *
 * NOTE: This module is defensive. It does not assume a specific token response
 * shape beyond common fields (access_token, expires_in). Adjust parsing if the
 * Stanbic sandbox/prod token endpoint uses a different schema.
 */

const env = getEnv();

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

const TOKEN_CACHE_KEY = 'stanbic:access_token';

export function getStanbicBaseUrl(): string {
  return (
    env.STANBIC_SANDBOX_URL_ENDPOINT ?? env.STANBIC_SANDBOX_BASE_URL ?? env.STANBIC_BASE_URL ?? 'https://sandbox.stanbicbank.example'
  );
}

export async function getCachedStanbicToken(): Promise<string | null> {
  try {
    const cached = await redis.get<string>(TOKEN_CACHE_KEY);
    if (cached) return cached;
  } catch (err) {
    // Non-fatal: log and continue to fetch live token
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

/**
 * Fetch a fresh token from the configured STANBIC_TOKEN_URL.
 * Uses the configured STANBIC_API_KEY or STANBIC_SANDBOX_API_KEY as a bearer
 * if present. Caller should prefer getStanbicToken() which will cache results.
 */
export async function fetchStanbicToken(): Promise<{ token: string; expiresIn: number } > {
  const tokenUrl = env.STANBIC_TOKEN_URL;
  if (!tokenUrl) throw new Error('STANBIC_TOKEN_URL not configured');

  const apiKey = env.STANBIC_API_KEY ?? env.STANBIC_SANDBOX_API_KEY ?? '';

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  let resp: Response;
  try {
    resp = await fetch(tokenUrl, {
      method: 'POST',
      headers,
      // Keep body minimal — many token endpoints accept client credentials in body
      body: JSON.stringify({ grant_type: 'client_credentials' }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch Stanbic token: ${msg}`);
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '(unreadable body)');
    throw new Error(`Stanbic token endpoint returned ${resp.status}: ${body}`);
  }

  const dataRaw = await resp.json().catch(() => null) as unknown;
  const data = (dataRaw && typeof dataRaw === 'object') ? (dataRaw as Record<string, unknown>) : null;
  if (!data) throw new Error('Stanbic token endpoint returned invalid JSON');

  // Common shapes: { access_token, expires_in } or { token, expires_in }
  const token = typeof data['access_token'] === 'string' ? data['access_token']
    : typeof data['token'] === 'string' ? data['token']
    : typeof data['accessToken'] === 'string' ? data['accessToken']
    : typeof data['access'] === 'string' ? data['access']
    : null;

  const expiresInRaw = data['expires_in'] ?? data['expiresIn'] ?? 3600;
  const expiresIn = Number(expiresInRaw);

  if (!token) throw new Error('Stanbic token response did not include an access token');

  return { token, expiresIn: Number.isFinite(expiresIn) ? expiresIn : 3600 };
}

/**
 * Public helper: getStanbicToken
 * - returns cached token when available
 * - otherwise fetches fresh token and caches it in Upstash Redis
 */
export async function getStanbicToken(): Promise<string> {
  // Try cache first
  const cached = await getCachedStanbicToken();
  if (cached) return cached;

  const { token, expiresIn } = await fetchStanbicToken();

  // Cache with a safety margin (60s)
  const ttl = Math.max(60, expiresIn - 60);
  await cacheStanbicToken(token, ttl);

  return token;
}

/**
 * Build Authorization header for Stanbic API calls. Prefer token if configured.
 * If token endpoint is not configured, fall back to API key as Bearer.
 */
export async function getStanbicAuthHeader(): Promise<Record<string, string>> {
  try {
    if (env.STANBIC_TOKEN_URL) {
      const t = await getStanbicToken();
      return { Authorization: `Bearer ${t}` };
    }
  } catch (err) {
    console.error('[Stanbic Client] Token retrieval failed:', err instanceof Error ? err.message : String(err));
  }

  const apiKey = env.STANBIC_API_KEY ?? env.STANBIC_SANDBOX_API_KEY ?? '';
  if (apiKey) return { Authorization: `Bearer ${apiKey}` };

  return {};
}
