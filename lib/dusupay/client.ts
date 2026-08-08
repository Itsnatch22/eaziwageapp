import { createHmac, timingSafeEqual } from 'crypto';
import {
  PayoutRequest,
  PayoutResponse,
  BalanceResponse,
  ProviderResponse,
  BankCodesResponse,
  SendFundsPayload,
  CollectionRequest,
  CollectionResponse,
} from './types';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

// Thrown only when fetch() itself fails — DNS, connection reset, abort,
// timeout — meaning DusuPay's server never actually responded. Callers must
// treat this differently from a plain Error (which means a real HTTP
// response WAS received, just not a success): the outcome here is genuinely
// unknown, so it is never safe to assume "failed" and retry with the same
// merchant_reference. See the P4 plan / this session's resilience trace.
export class DusupayNetworkError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DusupayNetworkError';
  }
}

export class DusupayClient {
  private publicKey: string;
  private secretKey: string;
  private baseUrl: string;
  private environment: 'sandbox' | 'production';

  constructor() {
    this.environment = (process.env.DUSUPAY_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';

    // Same credential env vars as lib/dusupay.ts — there's only one DusuPay
    // account, not separate sandbox/production key pairs configured anywhere.
    this.publicKey = process.env.DUSUPAY_PUBLIC_KEY || '';
    this.secretKey = process.env.DUSUPAY_SECRET_KEY || '';

    if (this.environment === 'production') {
      this.baseUrl = process.env.DUSUPAY_PRODUCTION_BASE_URL || 'https://payments.dusupay.com';
    } else {
      // Default sandbox API host (must be the API, not the merchant dashboard)
      this.baseUrl = process.env.DUSUPAY_SANDBOX_BASE_URL || 'https://sandboxapi.dusupay.com';
    }
  }

  // Deliberate behavior: include 'secret-key' header only when a secret is set.
  // If you need to force sending an empty secret (for testing), set
  // DUSUPAY_INCLUDE_EMPTY_SECRET=true in the environment.
  private get headers(): Record<string, string> {
    const includeEmpty = process.env.DUSUPAY_INCLUDE_EMPTY_SECRET === 'true';
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-version': '1',
      'public-key': this.publicKey,
    };
    if (includeEmpty || this.secretKey) {
      h['secret-key'] = this.secretKey;
    }
    return h;
  }

  private normalizeHeaders(h?: HeadersInit): Record<string, string> {
    if (!h) return {};
    if (h instanceof Headers) {
      const out: Record<string, string> = {};
      h.forEach((v, k) => { out[k] = v; });
      return out;
    }
    if (Array.isArray(h)) {
      const out: Record<string, string> = {};
      for (const [k, v] of h) out[k] = v;
      return out;
    }
    return { ...(h as Record<string, string>) };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    let response: Response;
    try {
      const combinedHeaders: Record<string, string> = {
        ...this.headers,
        ...this.normalizeHeaders(options.headers),
      };

      response = await fetch(url, {
        ...options,
        headers: combinedHeaders as HeadersInit,
      });
    } catch (err: unknown) {
      // fetch() threw before any response arrived — a network-level failure,
      // not a rejection from DusuPay's server. Whether the request was ever
      // received/processed on their end is unknown.
      const message = err instanceof Error ? err.message : 'Network request failed';
      throw new DusupayNetworkError(`DusuPay request failed before a response was received: ${message}`, err);
    }

    const rawBody = await response.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawBody);
    } catch {
      // A non-JSON body means we hit the wrong host/path (e.g. a portal login
      // page or a generic 404), not a DusuPay API error — surface that clearly
      // instead of letting the JSON.parse SyntaxError leak out as-is.
      throw new Error(
        `DusuPay API returned a non-JSON response (status ${response.status}) from ${url}: ${rawBody.slice(0, 200)}`,
      );
    }

    if (!response.ok) {
      throw new Error((data.message as string | undefined) || `DusuPay API error: ${response.status}`);
    }

    return data as T;
  }

  async getWalletBalances(): Promise<BalanceResponse> {
    return this.request<BalanceResponse>('/data/wallet-balances');
  }

  async getPaymentProviders(): Promise<ProviderResponse> {
    return this.request<ProviderResponse>('/data/payment-providers');
  }

  async getBankCodes(providerCode: string): Promise<BankCodesResponse> {
    return this.request<BankCodesResponse>(`/data/payout-bank-codes?provider_code=${providerCode}`);
  }

  async sendFunds(payout: PayoutRequest): Promise<PayoutResponse> {
    // account_number is the field DusuPay's live API accepts for both MOBILE_MONEY
    // and BANK — confirmed by hand against sandboxapi.dusupay.com/payout/send-funds.
    // Sending `msisdn` at all (even alongside account_number) gets rejected with
    // "property msisdn should not exist" — their schema has no such field anymore.
    const payload: SendFundsPayload = {
      merchant_reference: payout.merchant_reference,
      transaction_method: payout.transaction_method,
      currency: payout.currency,
      amount: payout.amount,
      provider_code: payout.provider_code,
      customer_name: payout.customer_name,
      description: payout.description,
      account_number: payout.account_number,
    };

    if (payout.transaction_method !== 'MOBILE_MONEY') {
      if (payout.bank_code) {
        payload.extra_params = { bank_code: payout.bank_code };
      }
    }

    return this.request<PayoutResponse>('/payout/send-funds', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Verify transaction status manually
   */
  async verifyTransaction(merchantReference: string): Promise<PayoutResponse> {
    return this.request<PayoutResponse>(`/data/transaction/verify/${encodeURIComponent(merchantReference)}`);
  }

  get isConfigured(): boolean {
    return Boolean(this.publicKey && this.secretKey);
  }

  // New: checkPayoutStatus preserves network-error distinction — it will
  // rethrow DusupayNetworkError on network-level failures, and return a
  // structured { success: boolean, status, internalReference } on API
  // responses so callers can inspect without handling JSON parsing themselves.
  async checkPayoutStatus(merchantReference: string): Promise<{
    success: boolean;
    message: string;
    internalReference?: string | null;
    merchantReference?: string | null;
    status?: string | null;
    errorCode?: string | null;
    raw?: unknown;
  }> {
    try {
      const res = await this.request<Record<string, unknown>>(`/data/transaction/verify/${encodeURIComponent(merchantReference)}`);
      const data = res as any;
      return {
        success: true,
        message: data.message ?? 'Status retrieved',
        internalReference: data.data?.internal_reference ?? null,
        merchantReference: data.data?.merchant_reference ?? null,
        status: data.data?.transaction_status ?? null,
        errorCode: null,
        raw: data,
      };
    } catch (err: unknown) {
      if (err instanceof DusupayNetworkError) throw err;
      return { success: false, message: err instanceof Error ? err.message : String(err), errorCode: 'STATUS_ERROR', raw: err };
    }
  }

  /**
   * Initiate a collection (pull funds from a customer's mobile money account —
   * a direct-charge / STK-push-style request). Distinct endpoint and schema
   * from sendFunds(): uses `msisdn`, not `account_number`. Confirmed live
   * against sandboxapi.dusupay.com/collections/initialize for airtel_ke and
   * mpesa_ke (both returned 202 Accepted).
   */
  async initializeCollection(collection: CollectionRequest): Promise<CollectionResponse> {
    return this.request<CollectionResponse>('/collections/initialize', {
      method: 'POST',
      body: JSON.stringify(collection),
    });
  }
}

// Webhook helpers — exported standalone so they can be used from server-side
// webhook route handlers without pulling in the network client instance.
export function verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
  const webhookSecret = process.env.DUSUPAY_WEBHOOK_SECRET ?? '';
  if (!webhookSecret) return false;

  const headerParts = signatureHeader.split(',').map((part) => part.trim());
  const timestampPart = headerParts.find((part) => part.startsWith('t='));
  const signaturePart = headerParts.find((part) => part.startsWith('s='));
  const timestamp = timestampPart?.split('=')[1];
  const signature = signaturePart?.split('=')[1] ?? signatureHeader;

  if (timestamp && signature) {
    const parsedTimestamp = Number(timestamp);
    const now = Date.now();
    const timestampMs = Number.isFinite(parsedTimestamp)
      ? parsedTimestamp * (timestamp.length <= 10 ? 1000 : 1)
      : Date.parse(timestamp);

    if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > 5 * 60 * 1000) {
      return false;
    }

    const expected = createHmac('sha256', webhookSecret).update(`${timestamp}.${rawBody}`).digest('hex');

    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
    } catch {
      return false;
    }
  }

  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signatureHeader, 'hex'));
  } catch {
    return false;
  }
}

export function parseWebhook(body: unknown) {
  if (!isRecord(body)) {
    return { event: 'unknown', payload: {} } as any;
  }

  const event = typeof (body as any).event === 'string' ? (body as any).event : 'unknown';
  const payloadSource = isRecord((body as any).payload) ? (body as any).payload : (body as any);
  const payload = Object.fromEntries(
    Object.entries(payloadSource).filter((entry): entry is [string, any] => {
      const value = entry[1];
      return (
        value === null ||
        value === undefined ||
        ['string', 'number', 'boolean'].includes(typeof value)
      );
    })
  );

  return { event, payload } as any;
}

export const dusupayClient = new DusupayClient();
