import { createHmac, timingSafeEqual } from 'crypto';

class DusupayConfig {
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
  environment: 'sandbox' | 'production';

  constructor() {
    this.publicKey = process.env.DUSUPAY_PUBLIC_KEY ?? '';
    this.secretKey = process.env.DUSUPAY_SECRET_KEY ?? '';
    this.webhookSecret = process.env.DUSUPAY_WEBHOOK_SECRET ?? '';
    this.environment = (process.env.DUSUPAY_ENVIRONMENT as 'sandbox' | 'production') ?? 'sandbox';
  }

  get baseUrl(): string {
    return this.environment === 'production'
      ? 'https://payments.dusupay.com'
      : 'https://sandboxapi.dusupay.com';
  }

  get isConfigured(): boolean {
    return !!this.publicKey;
  }
}

export enum PayoutMethod {
  MOBILE_MONEY = 'MOBILE_MONEY',
  BANK = 'BANK',
}

export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum Currency {
  KES = 'KES',
  TZS = 'TZS',
  UGX = 'UGX',
  RWF = 'RWF',
  USD = 'USD',
}


// KE codes confirmed by hand against /data/payment-providers?currency=KES&transaction_type=payout
// (mpesa was previously mapped to the wrong code, 'safaricom_ke'). TZ/UG/RW are unverified —
// confirm against the same endpoint before relying on them for a real payout.
export const MOBILE_MONEY_PROVIDERS: Record<string, Record<string, string>> = {
  KE: { mpesa: 'mpesa_ke', safaricom: 'mpesa_ke', airtel: 'airtel_ke', airtelmoney: 'airtel_ke' },
  TZ: { mpesa: 'vodacom_tz', vodacom: 'vodacom_tz', airtel: 'airtel_tz', tigo: 'tigo_tz', halopesa: 'halotel_tz' },
  UG: { mtn: 'mtn_ug', airtel: 'airtel_ug' },
  RW: { mtn: 'mtn_rw', airtel: 'airtel_rw' },
};

type DusupayPayloadValue = string | number | boolean | null | undefined;

interface DusupayWebhookPayload extends Record<string, DusupayPayloadValue> {
  merchant_reference?: string;
  transaction_id?: string;
  internal_reference?: string;
  dusupay_reference?: string;
  transaction_status?: string;
  status?: string;
  amount?: string | number;
  currency?: string;
}

interface DusupayApiResponse {
  code?: number;
  status?: string;
  message?: string;
  data?: {
    internal_reference?: string;
    merchant_reference?: string;
    transaction_status?: PayoutStatus;
    payout_banks?: BankInfo[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface BankInfo {
  bank_code?: string;
  bank_name?: string;
  branch_code?: string;
  branch_name?: string;
  [key: string]: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;


export interface PayoutResponse {
  success: boolean;
  message: string;
  internalReference?: string;
  merchantReference?: string;
  status?: PayoutStatus;
  errorCode?: string;
  raw?: unknown;
}

export interface WebhookPayload {
  event: string;
  payload: DusupayWebhookPayload;
}


export class DusupayService {
  private config: DusupayConfig;
  private baseUrl: string;

  constructor(config?: DusupayConfig) {
    this.config = config ?? new DusupayConfig();
    this.baseUrl = this.config.baseUrl;
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'x-api-version': '1',
      'public-key': this.config.publicKey,
      ...(this.config.secretKey && { 'secret-key': this.config.secretKey }),
    };
  }

  async checkPayoutStatus(merchantReference: string): Promise<PayoutResponse> {
    if (!this.config.isConfigured) {
      return { success: false, message: 'Not configured', errorCode: 'NOT_CONFIGURED' };
    }

    try {
      const res = await fetch(
        `${this.baseUrl}/data/transaction/verify/${encodeURIComponent(merchantReference)}`,
        { headers: this.headers }
      );
      const data = await res.json() as DusupayApiResponse;

      if (res.ok) {
        return {
          success: true,
          message: 'Status retrieved',
          internalReference: data.data?.internal_reference,
          merchantReference: data.data?.merchant_reference,
          status: data.data?.transaction_status as PayoutStatus,
          raw: data,
        };
      }
      return { success: false, message: data.message || 'Failed', errorCode: String(data.code), raw: data };
    } catch (err: unknown) {
      return { success: false, message: getErrorMessage(err, 'Status lookup failed'), errorCode: 'STATUS_ERROR' };
    }
  }


  async getBanks(providerCode: string): Promise<BankInfo[]> {
    if (!this.config.isConfigured) return [];
    try {
      const res = await fetch(
        `${this.baseUrl}/data/payout-bank-codes?provider_code=${encodeURIComponent(providerCode)}`,
        { headers: this.headers }
      );
      const data = await res.json() as DusupayApiResponse;
      return data.data?.payout_banks ?? [];
    } catch {
      return [];
    }
  }


  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    if (!this.config.webhookSecret) return false;

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

      const expected = createHmac('sha256', this.config.webhookSecret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');

      try {
        return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
      } catch {
        return false;
      }
    }

    const expected = createHmac('sha256', this.config.webhookSecret)
      .update(rawBody)
      .digest('hex');

    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
    } catch {
      return false;
    }
  }

  parseWebhook(body: unknown): WebhookPayload {
    if (!isRecord(body)) {
      return { event: 'unknown', payload: {} };
    }

    const event = typeof body.event === 'string' ? body.event : 'unknown';
    const payloadSource = isRecord(body.payload) ? body.payload : body;
    const payload = Object.fromEntries(
      Object.entries(payloadSource).filter((entry): entry is [string, DusupayPayloadValue] => {
        const value = entry[1];
        return (
          value === null ||
          value === undefined ||
          ['string', 'number', 'boolean'].includes(typeof value)
        );
      })
    ) as DusupayWebhookPayload;

    return { event, payload };
  }
}


export const dusupay = new DusupayService();
