import {
  PayoutRequest,
  PayoutResponse,
  BalanceResponse,
  ProviderResponse,
  BankCodesResponse,
  SendFundsPayload,
} from './types';

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
      // NOT sdbxportal.dusupay.com — that's DusuPay's human merchant web portal
      // (redirects to an Oracle APEX login page) and 404s as HTML on API paths
      // like /payout/send-funds, which is what caused the "Unexpected token '<'"
      // JSON-parse crash. sandboxapi.dusupay.com is the actual API host, and is
      // what lib/dusupay.ts (the webhook/verify client) already uses correctly.
      this.baseUrl = process.env.DUSUPAY_SANDBOX_BASE_URL || 'https://sandboxapi.dusupay.com';
    }
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'x-api-version': '1',
      'public-key': this.publicKey,
      'secret-key': this.secretKey,
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

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
    return this.request<PayoutResponse>(`/data/transaction/verify/${merchantReference}`);
  }
}

export const dusupayClient = new DusupayClient();
