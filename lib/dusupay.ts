import { createHmac, timingSafeEqual } from 'crypto';

// ======================== CONFIG ========================
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

// ======================== TYPES / ENUMS ========================
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

// Provider mappings (same as your Python code)
export const MOBILE_MONEY_PROVIDERS: Record<string, Record<string, string>> = {
  KE: { mpesa: 'safaricom_ke', safaricom: 'safaricom_ke', airtel: 'airtel_ke', airtel_money: 'airtel_ke' },
  TZ: { mpesa: 'vodacom_tz', vodacom: 'vodacom_tz', airtel: 'airtel_tz', tigo: 'tigo_tz', halopesa: 'halotel_tz' },
  UG: { mtn: 'mtn_ug', airtel: 'airtel_ug' },
  RW: { mtn: 'mtn_rw', airtel: 'airtel_rw' },
};

export const COUNTRY_CURRENCY: Record<string, Currency> = {
  KE: Currency.KES,
  TZ: Currency.TZS,
  UG: Currency.UGX,
  RW: Currency.RWF,
};

// ======================== MODELS ========================
export interface PayoutRequest {
  amount: number;
  currency: string;
  method: PayoutMethod;
  providerId: string;           // provider_code in Dusupay
  accountNumber: string;
  accountName: string;
  merchantReference?: string;
  narration?: string;
  callbackUrl?: string;
  // Bank only
  bankCode?: string;
  branchCode?: string;
}

export interface PayoutResponse {
  success: boolean;
  message: string;
  internalReference?: string;
  merchantReference?: string;
  status?: PayoutStatus;
  errorCode?: string;
  raw?: any;
}

export interface WebhookPayload {
  event: string;
  payload: Record<string, any>;
}

// ======================== SERVICE ========================
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

  private generateReference(prefix = 'EWA'): string {
    const ts = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `${prefix}-${ts}-${random}`;
  }

  getProviderId(countryCode: string, providerName: string): string | null {
    const providers = MOBILE_MONEY_PROVIDERS[countryCode.toUpperCase()] ?? {};
    const key = providerName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return providers[key] ?? null;
  }

  getCurrency(countryCode: string): Currency {
    return COUNTRY_CURRENCY[countryCode.toUpperCase()] ?? Currency.USD;
  }

  // ======================== PAYOUTS ========================
  async createMobileMoneyPayout(
    amount: number,
    countryCode: string,
    providerName: string,
    phoneNumber: string,
    recipientName: string,
    reference?: string,
    narration?: string,
    callbackUrl?: string
  ): Promise<PayoutResponse> {
    if (!this.config.isConfigured) {
      return { success: false, message: 'Dusupay not configured', errorCode: 'NOT_CONFIGURED' };
    }

    const providerCode = this.getProviderId(countryCode, providerName);
    if (!providerCode) {
      return { success: false, message: `Unknown provider ${providerName} for ${countryCode}`, errorCode: 'INVALID_PROVIDER' };
    }

    const payload: any = {
      merchant_reference: reference || this.generateReference(),
      transaction_method: PayoutMethod.MOBILE_MONEY,
      currency: this.getCurrency(countryCode),
      amount,
      provider_code: providerCode,
      msisdn: phoneNumber,
      customer_name: recipientName,
      description: narration || 'EaziWage Advance Disbursement',
    };

    if (callbackUrl) payload.callback_url = callbackUrl;

    return this._executePayout(payload);
  }

  async createBankPayout(
    amount: number,
    countryCode: string,
    bankCode: string,
    accountNumber: string,
    accountName: string,
    reference?: string,
    narration?: string,
    callbackUrl?: string,
    branchCode?: string
  ): Promise<PayoutResponse> {
    if (!this.config.isConfigured) {
      return { success: false, message: 'Dusupay not configured', errorCode: 'NOT_CONFIGURED' };
    }

    const payload: any = {
      merchant_reference: reference || this.generateReference(),
      transaction_method: PayoutMethod.BANK,
      currency: this.getCurrency(countryCode),
      amount,
      provider_code: 'bank_ng', // adjust per country (use /data/payment-providers for exact)
      account_number: accountNumber,
      customer_name: accountName,
      description: narration || 'EaziWage Advance Disbursement',
      extra_params: { bank_code: bankCode },
    };

    if (branchCode) payload.extra_params.branch_code = branchCode;
    if (callbackUrl) payload.callback_url = callbackUrl;

    return this._executePayout(payload);
  }

  private async _executePayout(payload: any): Promise<PayoutResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/payout/send-funds`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && (data.code === 200 || data.code === 202)) {
        return {
          success: true,
          message: data.message || 'Payout initiated',
          internalReference: data.data?.internal_reference,
          merchantReference: data.data?.merchant_reference,
          status: data.data?.transaction_status as PayoutStatus,
          raw: data,
        };
      }

      return {
        success: false,
        message: data.message || 'Payout failed',
        errorCode: String(data.code || res.status),
        raw: data,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Network error',
        errorCode: 'NETWORK_ERROR',
      };
    }
  }

  // ======================== STATUS & UTILITIES ========================
  async checkPayoutStatus(merchantReference: string): Promise<PayoutResponse> {
    if (!this.config.isConfigured) {
      return { success: false, message: 'Not configured', errorCode: 'NOT_CONFIGURED' };
    }

    try {
      const res = await fetch(
        `${this.baseUrl}/data/transaction/verify/${encodeURIComponent(merchantReference)}`,
        { headers: this.headers }
      );
      const data = await res.json();

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
    } catch (err: any) {
      return { success: false, message: err.message, errorCode: 'STATUS_ERROR' };
    }
  }

  // Get banks for a specific bank provider (use payment-providers first to get provider_code)
  async getBanks(providerCode: string): Promise<any[]> {
    if (!this.config.isConfigured) return [];
    try {
      const res = await fetch(
        `${this.baseUrl}/data/payout-bank-codes?provider_code=${encodeURIComponent(providerCode)}`,
        { headers: this.headers }
      );
      const data = await res.json();
      return data.data?.payout_banks ?? [];
    } catch {
      return [];
    }
  }

  // ======================== WEBHOOK ========================
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.config.webhookSecret) return true; // dev mode

    const expected = createHmac('sha256', this.config.webhookSecret)
      .update(rawBody)
      .digest('hex');

    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  parseWebhook(body: any): WebhookPayload {
    return { event: body.event || 'unknown', payload: body.payload || body };
  }
}

// ======================== EXPORT ========================
export const dusupay = new DusupayService();

// Optional: Server Action example
export async function initiatePayoutAction(request: PayoutRequest) {
  'use server';
  if (request.method === PayoutMethod.MOBILE_MONEY) {
    // call createMobileMoneyPayout with mapped params
  }
  // ...
}
