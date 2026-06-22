import { PayoutProvider } from '@/lib/payoutProviders';

interface GenericConfig {
  token?: {
    url: string;
    method?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    response_token_path?: string; 
    expires_in_path?: string; 
  };
  initiate: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body_template?: Record<string, unknown>;
  };
  status?: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
  };
  retry?: {
    retries?: number;
    backoff_ms?: number;
  };
}

function replacePlaceholders(obj: unknown, values: Record<string, unknown>): unknown {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    return obj.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => String(values[key] ?? ''));
  }
  if (Array.isArray(obj)) return obj.map((v) => replacePlaceholders(v, values));
  if (typeof obj === 'object' && obj !== null) {
    const out: Record<string, unknown> = {};
    const entries = Object.entries(obj);
    for (const [k, v] of entries) {
      out[k] = replacePlaceholders(v, values);
    }
    return out;
  }
  return obj;
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export class GenericHttpProvider implements PayoutProvider {
  config: GenericConfig;
  tokenCache: { token?: string; expiresAt?: number } = {};

  constructor(config: GenericConfig) {
    this.config = config;
  }

  private async fetchWithRetry(url: string, options: RequestInit = {}, retries = 1, backoff = 300): Promise<unknown> {
    let attempt = 0;
    while (true) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
        const json = await res.json().catch(() => null);
        return json;
      } catch (err) {
        attempt++;
        if (attempt > retries) throw err;
        await sleep(backoff * attempt);
      }
    }
  }

  private async fetchToken() {
    if (!this.config.token) return undefined;
    if (this.tokenCache.token && this.tokenCache.expiresAt && Date.now() < this.tokenCache.expiresAt) return this.tokenCache.token;

    const tconf = this.config.token;
    const method = (tconf.method || 'POST').toUpperCase();
    const body = tconf.body ? JSON.stringify(tconf.body) : undefined;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(tconf.headers || {}) };

    const json = (await this.fetchWithRetry(tconf.url, { method, headers, body }, this.config.retry?.retries ?? 1, this.config.retry?.backoff_ms ?? 300) as Record<string, unknown>);
    const token = json?.[tconf.response_token_path || 'access_token'] as string | undefined;
    const expiresIn = json?.[tconf.expires_in_path || 'expires_in'] as number | string | undefined;
    if (token) {
      this.tokenCache.token = token;
      if (expiresIn) this.tokenCache.expiresAt = Date.now() + Number(expiresIn) * 1000 - 5000;
    }
    return token;
  }

  async validateDestination(payload: Record<string, unknown>) {
    if (!payload) return { valid: false, reason: 'Empty payload' };

    if (!payload.phone_number && !payload.account_number) return { valid: false, reason: 'Missing phone_number or account_number' };
    return { valid: true };
  }

  async initiateTransfer(payload: Record<string, unknown>) {
    try {
      const token = await this.fetchToken();
      const init = this.config.initiate;
      const headers: Record<string, string> = { ...(init.headers || {}) };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const bodyObj = replacePlaceholders(init.body_template || {}, payload);
      const body = JSON.stringify(bodyObj);
      const method = (init.method || 'POST').toUpperCase();

      const json = (await this.fetchWithRetry(init.url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body }, this.config.retry?.retries ?? 2, this.config.retry?.backoff_ms ?? 500) as Record<string, unknown>);

      const reference = (json['reference'] || json['transaction_id'] || json['id'] || null) as string | null;
      const success = !!(json && (json['success'] === true || reference));
      return { success, reference: reference ?? undefined, error: success ? undefined : JSON.stringify(json) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  async getTransferStatus(reference: string) {
    if (!this.config.status) return { status: 'unknown' };
    try {
      const st = this.config.status;
      const url = (replacePlaceholders(st.url, { reference }) as string);
      const token = await this.fetchToken();
      const headers: Record<string, string> = { ...(st.headers || {}) };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const method = (st.method || 'GET').toUpperCase();
      const json = (await this.fetchWithRetry(url, { method, headers }, this.config.retry?.retries ?? 1, this.config.retry?.backoff_ms ?? 300) as Record<string, unknown>);

      const status = (json['status'] || json['transaction_status'] || 'unknown') as string;
      return { status, detail: json };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'error', detail: message };
    }
  }
}
