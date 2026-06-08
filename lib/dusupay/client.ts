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
    
    if (this.environment === 'production') {
      this.publicKey = process.env.DUSUPAY_PRODUCTION_PUBLIC_KEY || '';
      this.secretKey = process.env.DUSUPAY_PRODUCTION_SECRET_KEY || '';
      this.baseUrl = process.env.DUSUPAY_PRODUCTION_BASE_URL || 'https://payments.dusupay.com';
    } else {
      this.publicKey = process.env.DUSUPAY_SANDBOX_PUBLIC_KEY || '';
      this.secretKey = process.env.DUSUPAY_SANDBOX_SECRET_KEY || '';
      this.baseUrl = process.env.DUSUPAY_SANDBOX_BASE_URL || 'https://sdbxportal.dusupay.com/';
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

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || `DusuPay API error: ${response.status}`);
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
    const payload: SendFundsPayload = {
      merchant_reference: payout.merchant_reference,
      transaction_method: payout.transaction_method,
      currency: payout.currency,
      amount: payout.amount,
      provider_code: payout.provider_code,
      customer_name: payout.customer_name,
      description: payout.description,
    };

    if (payout.transaction_method === 'MOBILE_MONEY') {
      payload.msisdn = payout.account_number;
    } else {
      payload.account_number = payout.account_number;
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
